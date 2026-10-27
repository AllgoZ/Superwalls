import "server-only";
import { z } from "zod";
import { promotionSchema } from "@/lib/admin/schemas/promotions";
import { queryOne, withTransaction } from "../../db";
import { ApiError } from "../../errors";
import { defineOp } from "../op";

export const promotionOps = [
  defineOp({
    name: "promotions.save",
    permission: "promotions.write",
    input: promotionSchema,
    async run(_ctx, input) {
      const values = [
        input.code, input.description, input.discountType, input.percentOff, input.fixedOffPaise, input.minOrderPaise,
        input.maxDiscountPaise, input.startsAt, input.expiresAt, input.maxUses, input.maxUsesPerCustomer, input.isActive,
      ];
      if (!input.id) {
        const row = await queryOne<{ id: string }>(
          `insert into promotions (code, description, discount_type, percent_off, fixed_off_paise, min_order_paise,
             max_discount_paise, starts_at, expires_at, max_uses, max_uses_per_customer, is_active)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
          values,
        );
        return { id: row!.id, created: true };
      }
      return withTransaction(async (tx) => {
        const existing = await tx.queryOne<{ code: string; used: string }>(
          "select code, (select count(*) from promotion_redemptions r where r.promotion_id = p.id) as used from promotions p where p.id = $1 for update",
          [input.id],
        );
        if (!existing) throw new ApiError("NOT_FOUND", "That coupon no longer exists.");
        // A code customers already redeemed keeps its identity, so reports and receipts still make sense.
        if (Number(existing.used) > 0 && existing.code !== input.code) {
          throw new ApiError("CONFLICT", "This code has already been used, so it can't be renamed. Create a new coupon instead.");
        }
        await tx.query(
          `update promotions set code=$2, description=$3, discount_type=$4, percent_off=$5, fixed_off_paise=$6, min_order_paise=$7,
             max_discount_paise=$8, starts_at=$9, expires_at=$10, max_uses=$11, max_uses_per_customer=$12, is_active=$13
           where id=$1`,
          [input.id, ...values],
        );
        return { id: input.id, created: false };
      });
    },
    audit: (input, result) => ({
      action: result.created ? "promotion.create" : "promotion.update",
      entityType: "promotion",
      entityId: result.id,
      summary: `${result.created ? "Created" : "Edited"} coupon ${input.code}`,
      metadata: {
        type: input.discountType, percentOff: input.percentOff, fixedOffPaise: input.fixedOffPaise, minOrderPaise: input.minOrderPaise,
        maxDiscountPaise: input.maxDiscountPaise, startsAt: input.startsAt, expiresAt: input.expiresAt, maxUses: input.maxUses,
        maxUsesPerCustomer: input.maxUsesPerCustomer, active: input.isActive,
      },
    }),
  }),

  defineOp({
    name: "promotions.setActive",
    permission: "promotions.write",
    input: z.object({ id: z.uuid(), active: z.boolean() }),
    async run(_ctx, input) {
      const row = await queryOne<{ id: string; code: string }>("update promotions set is_active = $2 where id = $1 returning id, code", [input.id, input.active]);
      if (!row) throw new ApiError("NOT_FOUND", "That coupon no longer exists.");
      return row;
    },
    audit: (input, result) => ({
      action: input.active ? "promotion.activate" : "promotion.deactivate",
      entityType: "promotion",
      entityId: result.id,
      summary: `${input.active ? "Activated" : "Deactivated"} coupon ${result.code}`,
    }),
  }),

  defineOp({
    name: "promotions.delete",
    permission: "promotions.write",
    input: z.object({ id: z.uuid() }),
    async run(_ctx, input) {
      return withTransaction(async (tx) => {
        const row = await tx.queryOne<{ code: string; used: string }>(
          "select code, (select count(*) from promotion_redemptions r where r.promotion_id = p.id) as used from promotions p where p.id = $1 for update",
          [input.id],
        );
        if (!row) throw new ApiError("NOT_FOUND", "That coupon no longer exists.");
        if (Number(row.used) > 0) throw new ApiError("CONFLICT", "This coupon has been used, so it can't be deleted. Deactivate it instead.");
        await tx.query("delete from promotions where id = $1", [input.id]);
        return { code: row.code };
      });
    },
    audit: (input, result) => ({ action: "promotion.delete", entityType: "promotion", entityId: input.id, summary: `Deleted coupon ${result.code}` }),
  }),
];
