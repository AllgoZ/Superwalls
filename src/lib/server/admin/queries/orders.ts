import "server-only";
import { createHash } from "node:crypto";
import { query, queryOne } from "../../db";
import { dateParam, likePattern, pageParams, param, type Paged, type SearchParams } from "../list";
import { assertCan, type AdminContext } from "../session";

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerType: "guest" | "registered";
  createdAt: string;
  itemCount: number;
  subtotalPaise: number;
  deliveryPaise: number;
  discountPaise: number;
  totalPaise: number;
  paymentStatus: string;
  orderStatus: string;
  refundRequired: boolean;
}

interface Raw {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_type: "guest" | "registered";
  created_at: string;
  item_count: string;
  subtotal_paise: string;
  delivery_paise: string;
  discount_paise: string;
  total_paise: string;
  payment_status: string;
  order_status: string;
  refund_required: boolean;
  total?: string;
}

const toRow = (r: Raw): AdminOrderRow => ({
  id: r.id,
  orderNumber: r.order_number,
  customerName: r.customer_name,
  customerEmail: r.customer_email,
  customerPhone: r.customer_phone,
  customerType: r.customer_type,
  createdAt: r.created_at,
  itemCount: Number(r.item_count),
  subtotalPaise: Number(r.subtotal_paise),
  deliveryPaise: Number(r.delivery_paise),
  discountPaise: Number(r.discount_paise),
  totalPaise: Number(r.total_paise),
  paymentStatus: r.payment_status,
  orderStatus: r.order_status,
  refundRequired: r.refund_required,
});

/** Order statuses selectable as tabs, plus two payment-based views. */
export const ORDER_VIEWS = ["pending_payment", "placed", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "payment_failed", "refunded"] as const;

const FILTER_SQL = `
  where ($1::text is null or o.order_number ilike $1 or o.customer_name ilike $1 or o.customer_phone ilike $1 or o.customer_email ilike $1)
    and case $2::text
          when 'payment_failed' then o.payment_status in ('failed')
          when 'refunded' then o.payment_status in ('refunded', 'partially_refunded')
          when 'all' then true
          else o.order_status = $2 end
    and ($3::text is null or case $3
          when 'unpaid' then o.payment_status in ('pending', 'initiated')
          when 'refunded' then o.payment_status in ('refunded', 'partially_refunded')
          else o.payment_status = $3 end)
    and ($4::text is null or o.customer_type = $4)
    and ($5::date is null or (o.created_at at time zone 'Asia/Kolkata')::date >= $5::date)
    and ($6::date is null or (o.created_at at time zone 'Asia/Kolkata')::date <= $6::date)
    and ($7::text is null or ($7 = 'refund' and exists (
          select 1 from payments p where p.order_id = o.id and p.refund_required and p.status <> 'refunded')))`;

const SELECT = `
  o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone, o.customer_type, o.created_at,
  (select coalesce(sum(i.quantity), 0) from order_items i where i.order_id = o.id) as item_count,
  o.subtotal_paise, o.delivery_paise, o.discount_paise, o.total_paise, o.payment_status, o.order_status,
  exists (select 1 from payments p where p.order_id = o.id and p.refund_required and p.status <> 'refunded') as refund_required`;

function filterArgs(sp: SearchParams): unknown[] {
  const q = param(sp, "q");
  return [
    q ? likePattern(q) : null,
    param(sp, "status") ?? "all",
    param(sp, "payment") ?? null,
    param(sp, "type") ?? null,
    dateParam(sp, "from") ?? null,
    dateParam(sp, "to") ?? null,
    param(sp, "attention") ?? null,
  ];
}

export async function listOrders(admin: AdminContext, sp: SearchParams, options: { all?: boolean } = {}): Promise<Paged<AdminOrderRow>> {
  assertCan(admin, "orders.read");
  const { page, pageSize, offset } = pageParams(sp);
  const rows = await query<Raw>(
    `select ${SELECT}, count(*) over() as total from orders o ${FILTER_SQL}
     order by o.created_at desc, o.id limit $8 offset $9`,
    [...filterArgs(sp), options.all ? 50_000 : pageSize, options.all ? 0 : offset],
  );
  return { rows: rows.map(toRow), total: Number(rows[0]?.total ?? 0), page, pageSize };
}

/** Counts per tab, for the tab strip. */
export async function orderTabCounts(admin: AdminContext): Promise<Record<string, number>> {
  assertCan(admin, "orders.read");
  const [row] = await query<Record<string, string>>(
    `select count(*) as "all",
       count(*) filter (where order_status = 'pending_payment') as pending_payment,
       count(*) filter (where order_status = 'placed') as placed,
       count(*) filter (where order_status = 'confirmed') as confirmed,
       count(*) filter (where order_status = 'processing') as processing,
       count(*) filter (where order_status = 'shipped') as shipped,
       count(*) filter (where order_status = 'out_for_delivery') as out_for_delivery,
       count(*) filter (where order_status = 'delivered') as delivered,
       count(*) filter (where order_status = 'cancelled') as cancelled,
       count(*) filter (where payment_status = 'failed') as payment_failed,
       count(*) filter (where payment_status in ('refunded', 'partially_refunded')) as refunded
     from orders`,
  );
  return Object.fromEntries(Object.entries(row ?? {}).map(([key, value]) => [key, Number(value)]));
}

export interface TimelineEntry {
  at: string;
  label: string;
  detail?: string;
  actor?: string;
  tone: "info" | "success" | "danger" | "neutral";
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  customerType: "guest" | "registered";
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Link target in the customers module. */
  customerId: string;
  address: { fullName?: string; mobile?: string; line1?: string; area?: string; city?: string; state?: string; pincode?: string; instructions?: string };
  createdAt: string;
  paidAt: string | null;
  orderStatus: string;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentReference: string | null;
  subtotalPaise: number;
  discountPaise: number;
  deliveryPaise: number;
  totalPaise: number;
  refundedPaise: number;
  couponCode: string | null;
  cancelReason: string | null;
  items: { productId: string; name: string; sku: string | null; imageSrc: string | null; unitPricePaise: number; quantity: number; lineTotalPaise: number }[];
  payments: { id: string; provider: string; status: string; amountPaise: number; providerOrderId: string | null; providerPaymentId: string | null; failureReason: string | null; refundRequired: boolean; createdAt: string }[];
  timeline: TimelineEntry[];
  notes: { id: number; note: string; by: string; at: string }[];
  refundRequired: boolean;
}

export function guestCustomerId(email: string): string {
  return `g-${createHash("md5").update(email.trim().toLowerCase()).digest("hex")}`;
}

export async function getOrderDetail(admin: AdminContext, id: string): Promise<AdminOrderDetail | null> {
  assertCan(admin, "orders.read");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const o = await queryOne<{
    id: string; order_number: string; customer_type: "guest" | "registered"; user_id: string | null; customer_name: string; customer_email: string;
    customer_phone: string; address_snapshot: AdminOrderDetail["address"]; created_at: string; paid_at: string | null; order_status: string;
    payment_status: string; payment_provider: string | null; payment_reference: string | null; subtotal_paise: string; discount_paise: string;
    delivery_paise: string; total_paise: string; refunded_paise: string; coupon_code: string | null; cancel_reason: string | null;
  }>("select * from orders where id = $1", [id]);
  if (!o) return null;

  const [items, payments, events, notes] = await Promise.all([
    query<{ product_id: string; name: string; sku: string | null; image_src: string | null; unit_price_paise: string; quantity: number; line_total_paise: string }>(
      `select i.product_id, i.name, p.sku, i.image_src, i.unit_price_paise, i.quantity, i.line_total_paise
       from order_items i left join products p on p.id = i.product_id where i.order_id = $1 order by i.name`,
      [id],
    ),
    query<{ id: string; provider: string; status: string; amount: string; provider_order_id: string | null; provider_payment_id: string | null; failure_reason: string | null; refund_required: boolean; created_at: string }>(
      "select id, provider, status, amount, provider_order_id, provider_payment_id, failure_reason, refund_required, created_at from payments where order_id = $1 order by created_at",
      [id],
    ),
    query<{ status: string; note: string | null; created_at: string; admin_id: string | null; admin_name: string | null }>(
      `select e.status, e.note, e.created_at, e.admin_id, coalesce(nullif(m.display_name, ''), m.email) as admin_name
       from order_status_events e left join admin_members m on m.user_id = e.admin_id
       where e.order_id = $1 order by e.created_at, e.id`,
      [id],
    ),
    query<{ id: string; note: string; admin_email: string | null; created_at: string }>(
      "select id, note, admin_email, created_at from order_notes where order_id = $1 order by created_at desc",
      [id],
    ),
  ]);

  // Only moments backed by real rows: the order row, payment attempts, and recorded status events.
  const timeline: TimelineEntry[] = [{ at: o.created_at, label: "Order created", tone: "neutral" }];
  for (const p of payments) {
    timeline.push({ at: p.created_at, label: "Payment initiated", detail: `${p.provider}${p.failure_reason ? ` · ${p.failure_reason.replace(/_/g, " ")}` : ""}`, tone: "neutral" });
  }
  if (o.paid_at) timeline.push({ at: o.paid_at, label: "Payment confirmed", detail: o.payment_reference ?? undefined, tone: "success" });
  const LABEL: Record<string, string> = {
    placed: "Order placed", confirmed: "Order confirmed", processing: "Order processing", shipped: "Shipped",
    out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Order cancelled",
  };
  for (const e of events) {
    if (e.status === "pending_payment") continue;
    timeline.push({
      at: e.created_at,
      label: LABEL[e.status] ?? e.status,
      detail: e.note ?? undefined,
      actor: e.admin_name ?? undefined,
      tone: e.status === "cancelled" ? "danger" : e.status === "delivered" ? "success" : "info",
    });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  return {
    id: o.id,
    orderNumber: o.order_number,
    customerType: o.customer_type,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone,
    customerId: o.user_id ?? guestCustomerId(o.customer_email),
    address: o.address_snapshot ?? {},
    createdAt: o.created_at,
    paidAt: o.paid_at,
    orderStatus: o.order_status,
    paymentStatus: o.payment_status,
    paymentProvider: o.payment_provider,
    paymentReference: o.payment_reference,
    subtotalPaise: Number(o.subtotal_paise),
    discountPaise: Number(o.discount_paise),
    deliveryPaise: Number(o.delivery_paise),
    totalPaise: Number(o.total_paise),
    refundedPaise: Number(o.refunded_paise),
    couponCode: o.coupon_code,
    cancelReason: o.cancel_reason,
    items: items.map((i) => ({ productId: i.product_id, name: i.name, sku: i.sku, imageSrc: i.image_src, unitPricePaise: Number(i.unit_price_paise), quantity: i.quantity, lineTotalPaise: Number(i.line_total_paise) })),
    payments: payments.map((p) => ({ id: p.id, provider: p.provider, status: p.status, amountPaise: Number(p.amount), providerOrderId: p.provider_order_id, providerPaymentId: p.provider_payment_id, failureReason: p.failure_reason, refundRequired: p.refund_required, createdAt: p.created_at })),
    timeline,
    notes: notes.map((n) => ({ id: Number(n.id), note: n.note, by: n.admin_email ?? "Staff", at: n.created_at })),
    refundRequired: payments.some((p) => p.refund_required && p.status !== "refunded"),
  };
}
