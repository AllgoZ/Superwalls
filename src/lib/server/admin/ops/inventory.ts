import "server-only";
import { z } from "zod";
import { inventoryAdjustSchema } from "@/lib/admin/schemas/promotions";
import { queryOne } from "../../db";
import { ApiError } from "../../errors";
import { defineOp } from "../op";

export const inventoryOps = [
  defineOp({
    name: "inventory.adjust",
    permission: "inventory.adjust",
    input: inventoryAdjustSchema,
    async run({ admin }, input) {
      // Atomic in the database: row lock, reservation check, ledger entry. Nothing here touches payment data.
      const row = await queryOne<{ r: { productId: string; before: number; after: number; reserved: number } }>(
        "select public.admin_adjust_stock($1::uuid, $2::text, $3::text, $4::int, $5::text, $6::text) as r",
        [admin.userId, input.productId, input.mode, input.quantity, input.kind, input.reason],
      );
      return row!.r;
    },
    audit: (input, result) => ({
      action: "stock.adjust",
      entityType: "product",
      entityId: result.productId,
      summary: `Stock ${result.before} → ${result.after} (${input.kind}): ${input.reason}`,
      metadata: { before: result.before, after: result.after, kind: input.kind, reason: input.reason },
    }),
    revalidate: ["products"],
  }),

  defineOp({
    name: "inventory.setThreshold",
    permission: "inventory.adjust",
    input: z.object({ productId: z.string().min(2).max(60), threshold: z.number().int().min(0).max(100_000) }),
    async run(_ctx, input) {
      const row = await queryOne<{ id: string; old: number }>(
        `update products p set low_stock_threshold = $2
         from (select low_stock_threshold as old from products where id = $1) prev
         where p.id = $1 returning p.id, prev.old`,
        [input.productId, input.threshold],
      );
      if (!row) throw new ApiError("NOT_FOUND", "That product no longer exists.");
      return { productId: row.id, before: row.old };
    },
    audit: (input, result) => ({
      action: "stock.threshold",
      entityType: "product",
      entityId: result.productId,
      summary: `Low-stock alert ${result.before} → ${input.threshold}`,
      metadata: { before: result.before, after: input.threshold },
    }),
  }),
];
