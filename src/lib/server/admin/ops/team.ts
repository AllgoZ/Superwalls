import "server-only";
import { z } from "zod";
import { MEMBER_STATUSES, ROLES } from "@/lib/admin/permissions";
import { emailsAreAutoConfirmed } from "../../auth";
import { queryOne } from "../../db";
import { ApiError } from "../../errors";
import { defineOp } from "../op";

const role = z.enum(ROLES);

export const teamOps = [
  defineOp({
    name: "team.invite",
    permission: "team.manage",
    input: z.object({
      email: z.string().trim().toLowerCase().email().max(254),
      displayName: z.string().trim().max(80).default(""),
      role,
    }),
    async run({ admin }, input) {
      // With auto-confirm on, "verified" proves nothing, and an attacker could pre-register the invited email.
      if (await emailsAreAutoConfirmed()) {
        throw new ApiError(
          "CONFLICT",
          "Email confirmation is switched off in Supabase Auth, so invitations are unsafe. Turn on 'Confirm email', or provision the admin with the bootstrap script.",
        );
      }
      const row = await queryOne<{ r: { id: string; status: string } }>(
        "select public.admin_invite_member($1::uuid, $2::text, $3::text, $4::text, true) as r",
        [admin.userId, input.email, input.role, input.displayName],
      );
      return row!.r;
    },
    audit: (input, result) => ({
      action: "team.invite",
      entityType: "admin_member",
      entityId: result.id,
      summary: `Invited ${input.email} as ${input.role}`,
      metadata: { email: input.email, role: input.role, status: result.status },
    }),
  }),

  defineOp({
    name: "team.update",
    permission: "team.manage",
    input: z
      .object({
        memberId: z.uuid(),
        role: role.optional(),
        status: z.enum(MEMBER_STATUSES.filter((status) => status !== "invited") as ["active", "suspended", "revoked"]).optional(),
      })
      .refine((value) => value.role !== undefined || value.status !== undefined, "Nothing to change."),
    async run({ admin }, input) {
      const row = await queryOne<{ r: { id: string; role: string; status: string } }>(
        "select public.admin_update_member($1::uuid, $2::uuid, $3::text, $4::text) as r",
        [admin.userId, input.memberId, input.role ?? null, input.status ?? null],
      );
      return row!.r;
    },
    audit: (input, result) => ({
      action: input.status === "revoked" ? "team.revoke" : input.status === "suspended" ? "team.suspend" : "team.update",
      entityType: "admin_member",
      entityId: result.id,
      summary: `Set role=${result.role}, status=${result.status}`,
      metadata: { requested: input, result },
    }),
  }),
];
