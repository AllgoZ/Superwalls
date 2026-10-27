import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_ACCESS_COOKIE } from "@/lib/admin/cookies";
import { isPermission, ROLES, type AdminRole, type AdminSummary, type Permission } from "@/lib/admin/permissions";
import { authUserFromToken, type AuthUser } from "../auth";
import { queryOne } from "../db";
import { ApiError } from "../errors";

/**
 * The verified admin behind a request. Built from three independent facts, all re-checked on every request:
 *   1. the access cookie is a token Supabase Auth accepts,
 *   2. that user has an ACTIVE row in `admin_members` (so suspension/revocation is immediate),
 *   3. the permissions come from the role matrix in the database.
 * Nothing here comes from user-editable metadata.
 */
export interface AdminContext {
  userId: string;
  email: string;
  memberId: string;
  displayName: string;
  role: AdminRole;
  permissions: Permission[];
}

export function can(admin: AdminContext, permission: Permission): boolean {
  return admin.permissions.includes(permission);
}

export function toSummary(admin: AdminContext): AdminSummary {
  return { email: admin.email, displayName: admin.displayName, role: admin.role, permissions: admin.permissions };
}

// Supabase validates the JWT; a short memo avoids a network round trip for every query of one page load.
// It is deliberately short and keyed by a hash, so a revoked token stops working within seconds.
const TOKEN_MEMO_MS = 10_000;
const tokenMemo = new Map<string, { user: AuthUser | null; at: number }>();

async function verifyToken(token: string): Promise<AuthUser | null> {
  const key = createHash("sha256").update(token).digest("hex");
  const hit = tokenMemo.get(key);
  if (hit && performance.now() - hit.at < TOKEN_MEMO_MS) return hit.user;
  const user = await authUserFromToken(token).catch(() => null);
  if (tokenMemo.size > 200) tokenMemo.clear();
  tokenMemo.set(key, { user, at: performance.now() });
  return user;
}

export async function loadAdminContext(token: string): Promise<AdminContext | null> {
  const user = await verifyToken(token);
  if (!user?.email) return null;

  // One round trip: the member row and the permissions of its role.
  const member = await queryOne<{ id: string; role: string; display_name: string; permissions: string[] }>(
    `select m.id, m.role, m.display_name,
            array(select rp.permission from admin_role_permissions rp where rp.role = m.role) as permissions
     from admin_members m where m.user_id = $1 and m.status = 'active'`,
    [user.id],
  );
  if (!member || !(ROLES as readonly string[]).includes(member.role)) return null;

  return {
    userId: user.id,
    email: user.email,
    memberId: member.id,
    displayName: member.display_name,
    role: member.role as AdminRole,
    permissions: member.permissions.filter(isPermission),
  };
}

/** The signed-in admin for this request, or null. Deduplicated within one render. */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const token = (await cookies()).get(ADMIN_ACCESS_COOKIE)?.value;
  if (!token) return null;
  return loadAdminContext(token);
});

/** For pages: redirects to the login or the no-access screen instead of rendering. */
export async function requireAdmin(permission?: Permission | Permission[]): Promise<AdminContext> {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin/login");
  if (permission && !hasAny(admin, permission)) redirect("/admin/no-access");
  return admin;
}

/** For route handlers: throws a 401/403 ApiError. */
export async function requireAdminApi(permission?: Permission | Permission[]): Promise<AdminContext> {
  const admin = await getAdminContext();
  if (!admin) throw new ApiError("UNAUTHENTICATED", "Please sign in to the admin panel.");
  if (permission && !hasAny(admin, permission)) throw new ApiError("FORBIDDEN", "You don't have permission to do that.");
  return admin;
}

function hasAny(admin: AdminContext, permission: Permission | Permission[]): boolean {
  return (Array.isArray(permission) ? permission : [permission]).some((p) => can(admin, p));
}

/** Defence in depth for query modules: they refuse to run for an admin who lacks the permission. */
export function assertCan(admin: AdminContext, permission: Permission): void {
  if (!can(admin, permission)) throw new ApiError("FORBIDDEN", "You don't have permission to do that.");
}
