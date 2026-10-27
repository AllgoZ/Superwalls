import "server-only";
import type { AttentionItem } from "@/components/admin/admin-shell";
import { query } from "../../db";
import { can, type AdminContext } from "../session";

/** Counts shown in the notification bell. Only what the admin is allowed to see; every row is a real query. */
export async function getAttention(admin: AdminContext): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  if (can(admin, "orders.read")) {
    const [row] = await query<{ new_orders: string; refund_orders: string; failed_orders: string }>(
      `select
         count(*) filter (where order_status = 'placed' and payment_status = 'paid') as new_orders,
         count(*) filter (where exists (
           select 1 from payments p where p.order_id = o.id and p.refund_required and p.status <> 'refunded')) as refund_orders,
         count(*) filter (where order_status = 'pending_payment' and payment_status = 'failed'
                            and created_at > now() - interval '3 days') as failed_orders
       from orders o`,
    );
    const newOrders = Number(row?.new_orders ?? 0);
    const refunds = Number(row?.refund_orders ?? 0);
    const failed = Number(row?.failed_orders ?? 0);
    if (newOrders > 0) items.push({ id: "new-orders", label: "New paid orders to confirm", count: newOrders, href: "/admin/orders?status=placed", tone: "info" });
    if (refunds > 0) items.push({ id: "refunds", label: "Orders awaiting a refund", count: refunds, href: "/admin/orders?attention=refund", tone: "danger" });
    if (failed > 0) items.push({ id: "failed", label: "Failed payments (last 3 days)", count: failed, href: "/admin/orders?payment=failed", tone: "warning" });
  }

  if (can(admin, "inventory.read")) {
    const [row] = await query<{ low: string; out: string }>(
      `select count(*) filter (where stock - stock_reserved > 0 and stock - stock_reserved <= low_stock_threshold) as low,
              count(*) filter (where stock - stock_reserved <= 0) as out
       from products where is_active and archived_at is null`,
    );
    const low = Number(row?.low ?? 0);
    const out = Number(row?.out ?? 0);
    if (out > 0) items.push({ id: "out-of-stock", label: "Products out of stock", count: out, href: "/admin/inventory?view=out", tone: "danger" });
    if (low > 0) items.push({ id: "low-stock", label: "Products running low", count: low, href: "/admin/inventory?view=low", tone: "warning" });
  }

  return items;
}
