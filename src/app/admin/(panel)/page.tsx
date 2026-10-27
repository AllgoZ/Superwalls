import Link from "next/link";
import { AlertTriangle, Boxes, CheckCircle2, Clock, IndianRupee, Package, PackageX, ShoppingBag, Users } from "lucide-react";
import { BarChart, LineChart, type ChartPoint } from "@/components/admin/charts";
import { MetricCard, percentChange } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { RangeSelector } from "@/components/admin/range-selector";
import { SectionCard } from "@/components/admin/table-card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/common/status-badge";
import { formatDate, formatDateTime } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import { getDashboard } from "@/lib/server/admin/queries/dashboard";
import { resolveRange } from "@/lib/server/admin/range";
import { can, requireAdmin } from "@/lib/server/admin/session";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Dashboard" };

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function List({ empty, children }: { empty: string; children: React.ReactNode[] }) {
  return children.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y">{children}</ul>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin("dashboard.view");
  const range = resolveRange(await searchParams);
  const data = await getDashboard(admin, range);
  const { kpis } = data;
  const showSales = Boolean(data.current && data.previous && data.series);

  const revenuePoints: ChartPoint[] = (data.series ?? []).map((p) => ({ label: dayLabel(p.day), value: p.revenuePaise }));
  const orderPoints: ChartPoint[] = (data.series ?? []).map((p) => ({ label: dayLabel(p.day), value: p.orders }));

  return (
    <>
      <PageHeader title={`Welcome${admin.displayName ? `, ${admin.displayName}` : ""}`} description="How SuperWalls is doing. Figures come straight from the database." />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.revenuePaise !== undefined ? <MetricCard label="Total revenue" value={formatINR(kpis.revenuePaise)} hint="Paid, uncancelled, net of refunds" icon={<IndianRupee />} /> : null}
        {kpis.totalOrders !== undefined ? <MetricCard label="Total orders" value={kpis.totalOrders} hint={`${kpis.awaitingPayment ?? 0} awaiting payment`} icon={<ShoppingBag />} /> : null}
        {kpis.pendingOrders !== undefined ? <MetricCard label="Pending orders" value={kpis.pendingOrders} hint="Paid, not yet delivered" icon={<Clock />} tone={kpis.pendingOrders > 0 ? "warning" : "default"} /> : null}
        {kpis.completedOrders !== undefined ? <MetricCard label="Completed orders" value={kpis.completedOrders} hint="Delivered" icon={<CheckCircle2 />} /> : null}
        {kpis.customers !== undefined ? <MetricCard label="Total customers" value={kpis.customers} hint="Registered + guests" icon={<Users />} /> : null}
        {kpis.activeProducts !== undefined ? <MetricCard label="Active products" value={kpis.activeProducts} icon={<Package />} /> : null}
        {kpis.lowStock !== undefined ? <MetricCard label="Low-stock products" value={kpis.lowStock} icon={<Boxes />} tone={kpis.lowStock > 0 ? "warning" : "default"} /> : null}
        {kpis.outOfStock !== undefined ? <MetricCard label="Out of stock" value={kpis.outOfStock} icon={<PackageX />} tone={kpis.outOfStock > 0 ? "danger" : "default"} /> : null}
      </div>

      {showSales && data.current && data.previous ? (
        <section className="mb-5 space-y-3" aria-labelledby="sales-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="sales-heading" className="text-base font-bold text-ink">Sales · {range.label}</h2>
              <p className="text-xs text-muted-foreground">
                {range.from} to {range.to} (India time). Compared with {range.prevFrom} to {range.prevTo}.
              </p>
            </div>
            <RangeSelector active={range.key} from={range.from} to={range.to} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Revenue" value={formatINR(data.current.revenuePaise)} delta={percentChange(data.current.revenuePaise, data.previous.revenuePaise)} />
            <MetricCard label="Paid orders" value={data.current.paidOrders} delta={percentChange(data.current.paidOrders, data.previous.paidOrders)} hint={`${data.current.ordersCreated} placed in total`} />
            <MetricCard label="Average order value" value={formatINR(data.current.averageOrderPaise)} delta={percentChange(data.current.averageOrderPaise, data.previous.averageOrderPaise)} />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <SectionCard title="Revenue over time" description="By the day the payment was verified">
              <BarChart points={revenuePoints} format={(v) => formatINR(v)} ariaLabel={`Revenue per day, ${range.label}`} />
            </SectionCard>
            <SectionCard title="Orders over time" description="By the day the order was created">
              <LineChart points={orderPoints} format={(v) => String(v)} ariaLabel={`Orders per day, ${range.label}`} />
            </SectionCard>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {data.recentOrders ? (
          <SectionCard title="Recent orders" actions={<Link href="/admin/orders" className="text-xs font-semibold text-primary hover:underline">View all</Link>}>
            <List empty="No orders yet.">
              {data.recentOrders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">{order.orderNumber}</Link>
                    <p className="truncate text-xs text-muted-foreground">{order.customer} · {formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{formatINR(order.totalPaise)}</span>
                    <PaymentStatusBadge status={order.paymentStatus as PaymentStatus} />
                    <OrderStatusBadge status={order.orderStatus as OrderStatus} />
                  </div>
                </li>
              ))}
            </List>
          </SectionCard>
        ) : null}

        {data.attention ? (
          <SectionCard title="Orders requiring attention" description="Refunds due, unconfirmed paid orders and recent failed payments">
            <List empty="Nothing needs attention.">
              {data.attention.map((item) => (
                <li key={`${item.id}-${item.reason}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <Link href={`/admin/orders/${item.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">{item.orderNumber}</Link>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#7a5b00]"><AlertTriangle className="size-3.5" aria-hidden /> {item.reason}</span>
                </li>
              ))}
            </List>
          </SectionCard>
        ) : null}

        {data.topProducts ? (
          <SectionCard title="Top-selling products" description={`Units sold, ${range.label.toLowerCase()}`}>
            <List empty="No sales in this period.">
              {data.topProducts.map((product) => (
                <li key={product.productId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                  <Link href={`/admin/products/${product.productId}`} className="min-w-0 truncate font-medium text-ink hover:text-primary hover:underline">{product.name}</Link>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{product.units} sold · <span className="font-semibold text-ink">{formatINR(product.revenuePaise)}</span></span>
                </li>
              ))}
            </List>
          </SectionCard>
        ) : null}

        {data.lowStockProducts ? (
          <SectionCard title="Low-stock alerts" actions={can(admin, "inventory.read") ? <Link href="/admin/inventory" className="text-xs font-semibold text-primary hover:underline">Open inventory</Link> : null}>
            <List empty="All active products are comfortably stocked.">
              {data.lowStockProducts.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                  <Link href={`/admin/products/${product.id}`} className="min-w-0 truncate font-medium text-ink hover:text-primary hover:underline">{product.name}</Link>
                  <span className={`shrink-0 font-semibold tabular-nums ${product.available === 0 ? "text-danger" : "text-[#7a5b00]"}`}>{product.available === 0 ? "Out of stock" : `${product.available} left`}</span>
                </li>
              ))}
            </List>
          </SectionCard>
        ) : null}

        {data.newCustomers ? (
          <SectionCard title="Recent registrations" actions={<Link href="/admin/customers" className="text-xs font-semibold text-primary hover:underline">All customers</Link>}>
            <List empty="No registrations yet.">
              {data.newCustomers.map((customer) => (
                <li key={customer.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                  <Link href={`/admin/customers/${customer.id}`} className="min-w-0 truncate font-medium text-ink hover:text-primary hover:underline">{customer.name || customer.email}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDate(customer.createdAt)}</span>
                </li>
              ))}
            </List>
          </SectionCard>
        ) : null}

        {data.activity ? (
          <SectionCard title="Recent activity" actions={<Link href="/admin/activity-logs" className="text-xs font-semibold text-primary hover:underline">Full log</Link>}>
            <List empty="No activity recorded yet.">
              {data.activity.map((entry) => (
                <li key={entry.id} className="py-2.5 first:pt-0 last:pb-0 text-sm">
                  <p className="text-ink">{entry.summary || entry.action}</p>
                  <p className="text-xs text-muted-foreground">{entry.actor ?? "System"} · {formatDateTime(entry.createdAt)}</p>
                </li>
              ))}
            </List>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
