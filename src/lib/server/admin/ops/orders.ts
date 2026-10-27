import "server-only";
import { z } from "zod";
import { query, queryOne } from "../../db";
import { ApiError } from "../../errors";
import { defineOp } from "../op";

const orderId = z.uuid();

export const orderOps = [
  defineOp({
    name: "orders.setStatus",
    permission: "orders.update",
    input: z.object({
      orderId,
      // Cancellation has its own workflow (reason required); "paid" etc. are not statuses an admin can set at all.
      status: z.enum(["confirmed", "processing", "shipped", "out_for_delivery", "delivered"]),
      note: z.string().trim().max(300).optional(),
    }),
    async run({ admin }, input) {
      const row = await queryOne<{ r: { orderId: string; from: string; to: string } }>(
        "select public.admin_set_order_status($1::uuid, $2::uuid, $3::text, $4::text) as r",
        [admin.userId, input.orderId, input.status, input.note ?? null],
      );
      return row!.r;
    },
    audit: (_input, result) => ({
      action: "order.status",
      entityType: "order",
      entityId: result.orderId,
      summary: `Order status ${result.from} → ${result.to}`,
      metadata: { from: result.from, to: result.to },
    }),
  }),

  defineOp({
    name: "orders.cancel",
    permission: "orders.update",
    input: z.object({ orderId, reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(300) }),
    async run({ admin }, input) {
      const row = await queryOne<{ r: { orderId: string; wasPaid: boolean; refundRequired: boolean; restockedLines: number } }>(
        "select public.admin_cancel_order($1::uuid, $2::uuid, $3::text) as r",
        [admin.userId, input.orderId, input.reason],
      );
      return row!.r;
    },
    audit: (input, result) => ({
      action: "order.cancel",
      entityType: "order",
      entityId: result.orderId,
      summary: `Cancelled order${result.refundRequired ? " (refund required)" : ""}: ${input.reason}`,
      metadata: { reason: input.reason, wasPaid: result.wasPaid, refundRequired: result.refundRequired, restockedLines: result.restockedLines },
    }),
  }),

  defineOp({
    name: "orders.addNote",
    permission: "orders.update",
    input: z.object({ orderId, note: z.string().trim().min(1, "Write a note first.").max(1000) }),
    async run({ admin }, input) {
      const exists = await queryOne("select 1 from orders where id = $1", [input.orderId]);
      if (!exists) throw new ApiError("NOT_FOUND", "That order no longer exists.");
      await query("insert into order_notes (order_id, admin_id, admin_email, note) values ($1, $2, $3, $4)", [input.orderId, admin.userId, admin.email, input.note]);
      return { orderId: input.orderId };
    },
    audit: (_input, result) => ({ action: "order.note", entityType: "order", entityId: result.orderId, summary: "Added an internal note" }),
  }),
];
