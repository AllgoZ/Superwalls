import "server-only";
import { z } from "zod";
import { queryOne } from "../../db";
import { ApiError } from "../../errors";
import { defineOp } from "../op";

/**
 * Staff may correct a customer's NAME and PHONE. Email, password, sessions and sign-in are owned by Supabase Auth
 * and are deliberately out of reach: no impersonation, no password changes, no token access.
 */
export const customerOps = [
  defineOp({
    name: "customers.updateProfile",
    permission: "customers.update",
    input: z.object({
      userId: z.uuid(),
      fullName: z.string().trim().min(2, "Enter the customer's name.").max(80),
      mobile: z
        .string()
        .trim()
        .regex(/^([6-9][0-9]{9})?$/, "Enter a 10-digit Indian mobile number, or leave it empty."),
    }),
    async run(_ctx, input) {
      const before = await queryOne<{ full_name: string; mobile: string | null }>("select full_name, mobile from profiles where id = $1", [input.userId]);
      if (!before) throw new ApiError("NOT_FOUND", "That customer no longer exists.");
      await queryOne("update profiles set full_name = $2, mobile = nullif($3, '') where id = $1 returning id", [input.userId, input.fullName, input.mobile]);
      return { userId: input.userId, before: { name: before.full_name, mobile: before.mobile ? "set" : "empty" } };
    },
    audit: (input, result) => ({
      action: "customer.update",
      entityType: "customer",
      entityId: result.userId,
      summary: "Corrected a customer's profile",
      // Personal data is not copied into the log: only what changed in kind.
      metadata: { nameChanged: result.before.name !== input.fullName, mobileNow: input.mobile ? "set" : "empty" },
    }),
  }),
];
