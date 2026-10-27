import "server-only";
import { emailsAreAutoConfirmed, supabaseConfig } from "../auth";
import { queryOne } from "../db";
import { ApiError } from "../errors";

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  email: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string; email_confirmed_at?: string | null };
}

/**
 * Password sign-in for staff. Supabase Auth checks the password; our database then decides whether that
 * account is staff at all. The failure message is the same for "wrong password" and "not an admin" so the
 * form cannot be used to discover which emails belong to staff.
 */
export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const denied = new ApiError("UNAUTHENTICATED", "Incorrect email or password, or this account has no admin access.");
  if (!response.ok) throw denied;

  const token = (await response.json()) as TokenResponse;
  const user = token.user;
  if (!token.access_token || !token.refresh_token || !user?.id || !user.email) throw denied;

  // Invitations bind only to an email Supabase has verified (and never when the project auto-confirms).
  const verified = Boolean(user.email_confirmed_at) && !(await emailsAreAutoConfirmed());
  const result = await queryOne<{ r: { status: string } | null }>("select public.admin_resolve_login($1::uuid, $2::text) as r", [
    user.id,
    verified ? user.email : null,
  ]);
  const status = result?.r?.status;
  if (!status) throw denied;
  if (status !== "active") throw new ApiError("FORBIDDEN", "This admin account is suspended. Contact a super admin.");

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in ?? 3600,
    userId: user.id,
    email: user.email,
  };
}

/** Best-effort server-side logout so the refresh token cannot be reused. */
export async function revokeAdminSession(accessToken: string): Promise<void> {
  const { url, key } = supabaseConfig();
  await fetch(`${url}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => undefined);
}
