import "server-only";
import type { AdminRole, MemberStatus } from "@/lib/admin/permissions";
import { query } from "../../db";
import { assertCan, type AdminContext } from "../session";

export interface TeamMember {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: MemberStatus;
  invitedAt: string;
  inviteExpiresAt: string | null;
  inviteExpired: boolean;
  activatedAt: string | null;
  lastLoginAt: string | null;
  isSelf: boolean;
}

export async function listTeam(admin: AdminContext): Promise<TeamMember[]> {
  assertCan(admin, "team.manage");
  const rows = await query<{
    id: string; email: string; display_name: string; role: AdminRole; status: MemberStatus; invited_at: string; invite_expires_at: string | null;
    activated_at: string | null; last_login_at: string | null; user_id: string | null; expired: boolean;
  }>(
    `select id, email, display_name, role, status, invited_at, invite_expires_at, activated_at, last_login_at, user_id,
            (status = 'invited' and invite_expires_at is not null and invite_expires_at < now()) as expired
     from admin_members order by (status = 'revoked'), (status = 'invited') desc, created_at`,
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    status: r.status,
    invitedAt: r.invited_at,
    inviteExpiresAt: r.invite_expires_at,
    inviteExpired: r.expired,
    activatedAt: r.activated_at,
    lastLoginAt: r.last_login_at,
    isSelf: r.user_id === admin.userId,
  }));
}
