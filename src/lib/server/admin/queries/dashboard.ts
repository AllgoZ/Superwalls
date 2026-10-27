import "server-only";
import { query } from "../../db";
import type { DateRange } from "../range";
import { IST_DATE_CREATED, IST_DATE_PAID, NET_PAISE, REALISED } from "../revenue";
import { assertCan, can, type AdminContext } from "../session";

export interface PeriodTotals {
  revenuePaise: number;
  paidOrders: number;
  ordersCreated: number;
  averageOrderPaise: number;
}

export interface SeriesPoint {
  day: string;
  revenuePaise: number;
  orders: number;
}

/** Realised revenue, paid orders and created orders between two inclusive IST dates. */
export async function periodTotals(from: string, to: string): Promise<PeriodTotals> {
  const [row] = await query<{ revenue: string; paid_orders: string; created: string }>(
    `select
       coalesce(sum(${NET_PAISE}) filter (where ${REALISED} and ${IST_DATE_PAID} between $1::date and $2::date), 0) as revenue,
       count(*) filter (where ${REALISED} and ${IST_DATE_PAID} between $1::date and $2::date) as paid_orders,
       count(*) filter (where ${IST_DATE_CREATED} between $1::date and $2::date) as created
     from orders o`,
    [from, to],
  );
  const revenuePaise = Number(row?.revenue ?? 0);
  const paidOrders = Number(row?.paid_orders ?? 0);
  return {
    revenuePaise,
    paidOrders,
    ordersCreated: Number(row?.created ?? 0),
    averageOrderPaise: paidOrders > 0 ? Math.round(revenuePaise / paidOrders) : 0,
  };
}

/** One point per calendar day, including days with no sales, so charts have no gaps. */
export async function dailySeries(from: string, to: string): Promise<SeriesPoint[]> {
  const rows = await query<{ day: string; revenue: string; orders: string }>(
    `with paid as (
       select ${IST_DATE_PAID} as day, sum(${NET_PAISE}) as revenue
       from orders o where ${REALISED} and ${IST_DATE_PAID} between $1::date and $2::date group by 1
     ), made as (
       select ${IST_DATE_CREATED} as day, count(*) as n
       from orders o where ${IST_DATE_CREATED} between $1::date and $2::date group by 1
     )
     select to_char(d, 'YYYY-MM-DD') as day, coalesce(paid.revenue, 0) as revenue, coalesce(made.n, 0) as orders
     from generate_series($1::date, $2::date, interval '1 day') d
     left join paid on paid.day = d::date left join made on made.day = d::date
     order by d`,
    [from, to],
  );
  return rows.map((r) => ({ day: r.day, revenuePaise: Number(r.revenue), orders: Number(r.orders) }));
}

export interface DashboardData {
  kpis: {
    revenuePaise?: number;
    totalOrders?: number;
    pendingOrders?: number;
    awaitingPayment?: number;
    completedOrders?: number;
    customers?: number;
    activeProducts?: number;
    lowStock?: number;
    outOfStock?: number;
  };
  current?: PeriodTotals;
  previous?: PeriodTotals;
  series?: SeriesPoint[];
  recentOrders?: { id: string; orderNumber: string; customer: string; createdAt: string; totalPaise: number; paymentStatus: string; orderStatus: string }[];
  topProducts?: { productId: string; name: string; units: number; revenuePaise: number }[];
  lowStockProducts?: { id: string; name: string; available: number; threshold: number }[];
  newCustomers?: { id: string; name: string; email: string; createdAt: string }[];
  attention?: { id: string; orderNumber: string; reason: string; createdAt: string }[];
  activity?: { id: number; action: string; summary: string; actor: string | null; createdAt: string }[];
}

/**
 * Every block is fetched only if the admin may see it, so an order manager's dashboard never even queries revenue.
 * All figures are aggregated in SQL; no table is ever loaded into the app to be summed there.
 */
export async function getDashboard(admin: AdminContext, range: DateRange): Promise<DashboardData> {
  assertCan(admin, "dashboard.view");
  const data: DashboardData = { kpis: {} };
  const jobs: Promise<void>[] = [];

  if (can(admin, "reports.view")) {
    jobs.push(
      (async () => {
        const [all, current, previous, series] = await Promise.all([
          query<{ revenue: string }>(`select coalesce(sum(${NET_PAISE}) filter (where ${REALISED}), 0) as revenue from orders o`),
          periodTotals(range.from, range.to),
          periodTotals(range.prevFrom, range.prevTo),
          dailySeries(range.from, range.to),
        ]);
        data.kpis.revenuePaise = Number(all[0]?.revenue ?? 0);
        data.current = current;
        data.previous = previous;
        data.series = series;
      })(),
      (async () => {
        const rows = await query<{ product_id: string; name: string; units: string; revenue: string }>(
          `select i.product_id, max(i.name) as name, sum(i.quantity) as units, sum(i.line_total_paise) as revenue
           from order_items i join orders o on o.id = i.order_id
           where ${REALISED} and ${IST_DATE_PAID} between $1::date and $2::date
           group by i.product_id order by units desc, revenue desc limit 5`,
          [range.from, range.to],
        );
        data.topProducts = rows.map((r) => ({ productId: r.product_id, name: r.name, units: Number(r.units), revenuePaise: Number(r.revenue) }));
      })(),
    );
  }

  if (can(admin, "orders.read")) {
    jobs.push(
      (async () => {
        const [row] = await query<Record<string, string>>(
          `select count(*) as total,
             count(*) filter (where order_status in ('placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery')) as open_orders,
             count(*) filter (where order_status = 'pending_payment') as awaiting_payment,
             count(*) filter (where order_status = 'delivered') as delivered
           from orders`,
        );
        data.kpis.totalOrders = Number(row?.total ?? 0);
        data.kpis.pendingOrders = Number(row?.open_orders ?? 0);
        data.kpis.awaitingPayment = Number(row?.awaiting_payment ?? 0);
        data.kpis.completedOrders = Number(row?.delivered ?? 0);
      })(),
      (async () => {
        const rows = await query<{ id: string; order_number: string; customer_name: string; created_at: string; total_paise: string; payment_status: string; order_status: string }>(
          "select id, order_number, customer_name, created_at, total_paise, payment_status, order_status from orders order by created_at desc limit 8",
        );
        data.recentOrders = rows.map((r) => ({ id: r.id, orderNumber: r.order_number, customer: r.customer_name, createdAt: r.created_at, totalPaise: Number(r.total_paise), paymentStatus: r.payment_status, orderStatus: r.order_status }));
      })(),
      (async () => {
        const rows = await query<{ id: string; order_number: string; reason: string; created_at: string }>(
          `select o.id, o.order_number, o.created_at,
             case
               when exists (select 1 from payments p where p.order_id = o.id and p.refund_required and p.status <> 'refunded') then 'Refund required'
               when o.order_status = 'placed' and o.created_at < now() - interval '24 hours' then 'Paid but unconfirmed for over 24 h'
               when o.payment_status = 'failed' and o.order_status = 'pending_payment' and o.created_at > now() - interval '3 days' then 'Payment failed'
             end as reason
           from orders o
           where exists (select 1 from payments p where p.order_id = o.id and p.refund_required and p.status <> 'refunded')
              or (o.order_status = 'placed' and o.created_at < now() - interval '24 hours')
              or (o.payment_status = 'failed' and o.order_status = 'pending_payment' and o.created_at > now() - interval '3 days')
           order by o.created_at desc limit 8`,
        );
        data.attention = rows.map((r) => ({ id: r.id, orderNumber: r.order_number, reason: r.reason, createdAt: r.created_at }));
      })(),
    );
  }

  if (can(admin, "customers.read")) {
    jobs.push(
      (async () => {
        const [row] = await query<{ n: string }>(
          "select (select count(*) from profiles) + (select count(distinct lower(customer_email)) from orders where customer_type = 'guest') as n",
        );
        data.kpis.customers = Number(row?.n ?? 0);
      })(),
      (async () => {
        const rows = await query<{ id: string; full_name: string; email: string | null; created_at: string }>(
          "select id, full_name, email, created_at from profiles order by created_at desc limit 5",
        );
        data.newCustomers = rows.map((r) => ({ id: r.id, name: r.full_name, email: r.email ?? "", createdAt: r.created_at }));
      })(),
    );
  }

  if (can(admin, "catalog.read") || can(admin, "inventory.read")) {
    jobs.push(
      (async () => {
        const [row] = await query<{ active: string; low: string; out: string }>(
          `select count(*) filter (where is_active and archived_at is null) as active,
             count(*) filter (where is_active and archived_at is null and stock - stock_reserved > 0 and stock - stock_reserved <= low_stock_threshold) as low,
             count(*) filter (where is_active and archived_at is null and stock - stock_reserved <= 0) as out
           from products`,
        );
        data.kpis.activeProducts = Number(row?.active ?? 0);
        data.kpis.lowStock = Number(row?.low ?? 0);
        data.kpis.outOfStock = Number(row?.out ?? 0);
      })(),
      (async () => {
        const rows = await query<{ id: string; name: string; available: number; low_stock_threshold: number }>(
          `select id, name, stock - stock_reserved as available, low_stock_threshold from products
           where is_active and archived_at is null and stock - stock_reserved <= low_stock_threshold
           order by stock - stock_reserved, name limit 8`,
        );
        data.lowStockProducts = rows.map((r) => ({ id: r.id, name: r.name, available: Math.max(0, r.available), threshold: r.low_stock_threshold }));
      })(),
    );
  }

  if (can(admin, "activity.view")) {
    jobs.push(
      (async () => {
        const rows = await query<{ id: string; action: string; summary: string; actor_email: string | null; created_at: string }>(
          "select id, action, summary, actor_email, created_at from admin_activity_logs order by created_at desc, id desc limit 8",
        );
        data.activity = rows.map((r) => ({ id: Number(r.id), action: r.action, summary: r.summary, actor: r.actor_email, createdAt: r.created_at }));
      })(),
    );
  }

  await Promise.all(jobs);
  return data;
}

