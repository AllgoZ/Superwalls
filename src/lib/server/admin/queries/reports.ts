import "server-only";
import { query } from "../../db";
import type { DateRange } from "../range";
import { IST_DATE_CREATED, IST_DATE_PAID, NET_PAISE, REALISED } from "../revenue";
import { assertCan, type AdminContext } from "../session";
import { dailySeries, periodTotals, type PeriodTotals, type SeriesPoint } from "./dashboard";

export interface SalesReport {
  totals: PeriodTotals;
  previous: PeriodTotals;
  series: SeriesPoint[];
  /** Money received vs given back vs net, for orders PAID in the range. */
  grossPaidPaise: number;
  refundedPaise: number;
  netRevenuePaise: number;
  /** What did NOT become revenue, shown separately so it is never mistaken for it. */
  pendingPayment: { orders: number; paise: number };
  failedPayment: { orders: number; paise: number };
  awaitingRefund: { orders: number; paise: number };
  monthly: { month: string; revenuePaise: number; paidOrders: number }[];
}

export async function salesReport(admin: AdminContext, range: DateRange): Promise<SalesReport> {
  assertCan(admin, "reports.view");
  const [totals, previous, series, split, monthly] = await Promise.all([
    periodTotals(range.from, range.to),
    periodTotals(range.prevFrom, range.prevTo),
    dailySeries(range.from, range.to),
    query<Record<string, string>>(
      `select
         coalesce(sum(o.total_paise) filter (where o.payment_status in ('paid', 'partially_refunded', 'refunded') and ${IST_DATE_PAID} between $1::date and $2::date), 0) as gross,
         coalesce(sum(o.refunded_paise) filter (where o.payment_status in ('paid', 'partially_refunded', 'refunded') and ${IST_DATE_PAID} between $1::date and $2::date), 0) as refunded,
         count(*) filter (where o.order_status = 'pending_payment' and o.payment_status in ('pending', 'initiated') and ${IST_DATE_CREATED} between $1::date and $2::date) as pending_n,
         coalesce(sum(o.total_paise) filter (where o.order_status = 'pending_payment' and o.payment_status in ('pending', 'initiated') and ${IST_DATE_CREATED} between $1::date and $2::date), 0) as pending_sum,
         count(*) filter (where o.payment_status = 'failed' and ${IST_DATE_CREATED} between $1::date and $2::date) as failed_n,
         coalesce(sum(o.total_paise) filter (where o.payment_status = 'failed' and ${IST_DATE_CREATED} between $1::date and $2::date), 0) as failed_sum,
         count(*) filter (where o.payment_status = 'paid' and o.order_status = 'cancelled' and ${IST_DATE_PAID} between $1::date and $2::date) as refund_n,
         coalesce(sum(o.total_paise) filter (where o.payment_status = 'paid' and o.order_status = 'cancelled' and ${IST_DATE_PAID} between $1::date and $2::date), 0) as refund_sum
       from orders o`,
      [range.from, range.to],
    ),
    query<{ month: string; revenue: string; paid: string }>(
      `select to_char(date_trunc('month', o.paid_at at time zone 'Asia/Kolkata'), 'YYYY-MM') as month,
              sum(${NET_PAISE}) as revenue, count(*) as paid
       from orders o where ${REALISED} and o.paid_at > now() - interval '12 months'
       group by 1 order by 1`,
    ),
  ]);
  const s = split[0] ?? {};
  const gross = Number(s.gross ?? 0);
  const refunded = Number(s.refunded ?? 0);
  return {
    totals,
    previous,
    series,
    grossPaidPaise: gross,
    refundedPaise: refunded,
    netRevenuePaise: totals.revenuePaise,
    pendingPayment: { orders: Number(s.pending_n ?? 0), paise: Number(s.pending_sum ?? 0) },
    failedPayment: { orders: Number(s.failed_n ?? 0), paise: Number(s.failed_sum ?? 0) },
    awaitingRefund: { orders: Number(s.refund_n ?? 0), paise: Number(s.refund_sum ?? 0) },
    monthly: monthly.map((m) => ({ month: m.month, revenuePaise: Number(m.revenue), paidOrders: Number(m.paid) })),
  };
}

export interface ProductPerformance {
  productId: string;
  name: string;
  units: number;
  revenuePaise: number;
}

export async function productReport(admin: AdminContext, range: DateRange): Promise<{ best: ProductPerformance[]; lowest: ProductPerformance[] }> {
  assertCan(admin, "reports.view");
  const rows = await query<{ id: string; name: string; units: string; revenue: string }>(
    `select p.id, p.name, coalesce(s.units, 0) as units, coalesce(s.revenue, 0) as revenue
     from products p
     left join (
       select i.product_id, sum(i.quantity) as units, sum(i.line_total_paise) as revenue
       from order_items i join orders o on o.id = i.order_id
       where ${REALISED} and ${IST_DATE_PAID} between $1::date and $2::date
       group by i.product_id
     ) s on s.product_id = p.id
     where p.archived_at is null`,
    [range.from, range.to],
  );
  const all = rows.map((r) => ({ productId: r.id, name: r.name, units: Number(r.units), revenuePaise: Number(r.revenue) }));
  const best = [...all].filter((p) => p.units > 0).sort((a, b) => b.units - a.units || b.revenuePaise - a.revenuePaise).slice(0, 10);
  const lowest = [...all].sort((a, b) => a.units - b.units || a.name.localeCompare(b.name)).slice(0, 10);
  return { best, lowest };
}

export interface OrderReport {
  total: number;
  delivered: number;
  cancelled: number;
  awaitingPayment: number;
  inProgress: number;
  paymentFailures: number;
}

export async function orderReport(admin: AdminContext, range: DateRange): Promise<OrderReport> {
  assertCan(admin, "reports.view");
  const [row] = await query<Record<string, string>>(
    `select count(*) as total,
       count(*) filter (where o.order_status = 'delivered') as delivered,
       count(*) filter (where o.order_status = 'cancelled') as cancelled,
       count(*) filter (where o.order_status = 'pending_payment') as awaiting,
       count(*) filter (where o.order_status in ('placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery')) as in_progress,
       count(*) filter (where o.payment_status = 'failed') as failed
     from orders o where ${IST_DATE_CREATED} between $1::date and $2::date`,
    [range.from, range.to],
  );
  return {
    total: Number(row?.total ?? 0),
    delivered: Number(row?.delivered ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    awaitingPayment: Number(row?.awaiting ?? 0),
    inProgress: Number(row?.in_progress ?? 0),
    paymentFailures: Number(row?.failed ?? 0),
  };
}

export interface CustomerReport {
  registered: number;
  guests: number;
  repeat: number;
  newRegistrations: number;
  newGuests: number;
}

export async function customerReport(admin: AdminContext, range: DateRange): Promise<CustomerReport> {
  assertCan(admin, "reports.view");
  assertCan(admin, "customers.read");
  const [row] = await query<Record<string, string>>(
    `select
       (select count(*) from profiles) as registered,
       (select count(distinct lower(customer_email)) from orders where customer_type = 'guest') as guests,
       (select count(*) from (
          select coalesce(o.user_id::text, lower(o.customer_email)) as who from orders o where ${REALISED}
          group by 1 having count(*) > 1) r) as repeat,
       (select count(*) from profiles where (created_at at time zone 'Asia/Kolkata')::date between $1::date and $2::date) as new_registered,
       (select count(*) from (
          select lower(customer_email) as e, min(created_at) as first_at from orders where customer_type = 'guest' group by 1) g
        where (g.first_at at time zone 'Asia/Kolkata')::date between $1::date and $2::date) as new_guests`,
    [range.from, range.to],
  );
  return {
    registered: Number(row?.registered ?? 0),
    guests: Number(row?.guests ?? 0),
    repeat: Number(row?.repeat ?? 0),
    newRegistrations: Number(row?.new_registered ?? 0),
    newGuests: Number(row?.new_guests ?? 0),
  };
}

export interface InventoryReport {
  activeProducts: number;
  unitsOnHand: number;
  low: { id: string; name: string; available: number; threshold: number }[];
  out: { id: string; name: string }[];
  adjustments: { count: number; unitsAdded: number; unitsRemoved: number };
}

export async function inventoryReport(admin: AdminContext, range: DateRange): Promise<InventoryReport> {
  assertCan(admin, "reports.view");
  assertCan(admin, "inventory.read");
  const [stock, low, out, adj] = await Promise.all([
    query<{ active: string; units: string }>(
      "select count(*) as active, coalesce(sum(stock), 0) as units from products where is_active and archived_at is null",
    ),
    query<{ id: string; name: string; available: number; low_stock_threshold: number }>(
      `select id, name, stock - stock_reserved as available, low_stock_threshold from products
       where is_active and archived_at is null and stock - stock_reserved > 0 and stock - stock_reserved <= low_stock_threshold
       order by stock - stock_reserved, name limit 20`,
    ),
    query<{ id: string; name: string }>("select id, name from products where is_active and archived_at is null and stock - stock_reserved <= 0 order by name limit 50"),
    query<{ n: string; added: string; removed: string }>(
      `select count(*) as n, coalesce(sum(quantity_change) filter (where quantity_change > 0), 0) as added,
              coalesce(-sum(quantity_change) filter (where quantity_change < 0), 0) as removed
       from inventory_movements
       where kind not in ('sale') and (created_at at time zone 'Asia/Kolkata')::date between $1::date and $2::date`,
      [range.from, range.to],
    ),
  ]);
  return {
    activeProducts: Number(stock[0]?.active ?? 0),
    unitsOnHand: Number(stock[0]?.units ?? 0),
    low: low.map((r) => ({ id: r.id, name: r.name, available: r.available, threshold: r.low_stock_threshold })),
    out,
    adjustments: { count: Number(adj[0]?.n ?? 0), unitsAdded: Number(adj[0]?.added ?? 0), unitsRemoved: Number(adj[0]?.removed ?? 0) },
  };
}
