import { Download } from "lucide-react";
import { BarChart, LineChart, type ChartPoint } from "@/components/admin/charts";
import { MetricCard, percentChange } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { RangeSelector } from "@/components/admin/range-selector";
import { SectionCard } from "@/components/admin/table-card";
import { buttonVariants } from "@/components/ui/button";
import { formatINR } from "@/lib/formatters/money";
import { customerReport, inventoryReport, orderReport, productReport, salesReport } from "@/lib/server/admin/queries/reports";
import { resolveRange } from "@/lib/server/admin/range";
import { can, requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Reports" };

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-3 font-semibold ${i > 0 ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={`py-2 pr-3 ${i > 0 ? "text-right tabular-nums" : "font-medium text-ink"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const admin = await requireAdmin("reports.view");
  const range = resolveRange(await searchParams);
  const canExport = can(admin, "reports.export");
  const seeCustomers = can(admin, "customers.read");
  const seeInventory = can(admin, "inventory.read");

  const [sales, products, orders, customers, inventory] = await Promise.all([
    salesReport(admin, range),
    productReport(admin, range),
    orderReport(admin, range),
    seeCustomers ? customerReport(admin, range) : Promise.resolve(null),
    seeInventory ? inventoryReport(admin, range) : Promise.resolve(null),
  ]);
  const qs = `range=${range.key}&from=${range.from}&to=${range.to}`;
  const exportLink = (kind: string, label: string) =>
    canExport ? (
      <a href={`/api/admin/export/${kind}?${qs}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <Download aria-hidden /> {label}
      </a>
    ) : null;

  const revenuePoints: ChartPoint[] = sales.series.map((p) => ({ label: dayLabel(p.day), value: p.revenuePaise }));
  const monthlyPoints: ChartPoint[] = sales.monthly.map((m) => ({ label: monthLabel(m.month), value: m.revenuePaise, hint: `${m.paidOrders} orders` }));
  const orderPoints: ChartPoint[] = sales.series.map((p) => ({ label: dayLabel(p.day), value: p.orders }));

  return (
    <>
      <PageHeader title="Reports" description={`${range.label}: ${range.from} to ${range.to} (India time).`} actions={<RangeSelector active={range.key} from={range.from} to={range.to} />} />

      <p className="mb-5 rounded-lg bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-ink">How revenue is counted:</span> an order counts only after a verified payment, is not cancelled, and is valued net of refunds. Pending, failed and
        cancelled-unpaid orders never count, and a paid order that was cancelled is shown as &ldquo;awaiting refund&rdquo; instead. Each order is counted once.
      </p>

      <div className="space-y-5">
        <SectionCard title="Sales" actions={exportLink("sales", "Daily sales CSV")}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Net revenue" value={formatINR(sales.netRevenuePaise)} delta={percentChange(sales.totals.revenuePaise, sales.previous.revenuePaise)} />
            <MetricCard label="Paid orders" value={sales.totals.paidOrders} delta={percentChange(sales.totals.paidOrders, sales.previous.paidOrders)} />
            <MetricCard label="Average order value" value={formatINR(sales.totals.averageOrderPaise)} delta={percentChange(sales.totals.averageOrderPaise, sales.previous.averageOrderPaise)} />
            <MetricCard label="Orders placed" value={sales.totals.ordersCreated} hint="All statuses" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Gross paid" value={formatINR(sales.grossPaidPaise)} hint="Before refunds" />
            <MetricCard label="Refunded" value={formatINR(sales.refundedPaise)} hint="Recorded refunds" />
            <MetricCard label="Awaiting refund" value={formatINR(sales.awaitingRefund.paise)} hint={`${sales.awaitingRefund.orders} cancelled paid order(s)`} tone={sales.awaitingRefund.orders > 0 ? "danger" : "default"} />
            <MetricCard label="Not revenue yet" value={formatINR(sales.pendingPayment.paise)} hint={`${sales.pendingPayment.orders} awaiting payment · ${sales.failedPayment.orders} failed`} />
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-bold text-ink">Daily sales</h3>
              <BarChart points={revenuePoints} format={(v) => formatINR(v)} ariaLabel="Net revenue per day" />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-bold text-ink">Orders per day</h3>
              <LineChart points={orderPoints} format={(v) => String(v)} ariaLabel="Orders placed per day" />
            </div>
          </div>
          <div className="mt-5">
            <h3 className="mb-1 text-sm font-bold text-ink">Monthly sales (last 12 months)</h3>
            {sales.monthly.length === 0 ? <p className="text-sm text-muted-foreground">No paid orders in the last 12 months.</p> : <BarChart points={monthlyPoints} format={(v) => formatINR(v)} ariaLabel="Net revenue per month" />}
          </div>
        </SectionCard>

        <SectionCard title="Products" actions={exportLink("products", "Product sales CSV")}>
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink">Best sellers</h3>
              <Table head={["Product", "Units", "Revenue"]} empty="No sales in this period." rows={products.best.map((p) => [p.name, p.units, formatINR(p.revenuePaise)])} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink">Lowest performing</h3>
              <Table head={["Product", "Units", "Revenue"]} empty="No products." rows={products.lowest.map((p) => [p.name, p.units, formatINR(p.revenuePaise)])} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Orders">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total" value={orders.total} />
            <MetricCard label="Delivered" value={orders.delivered} />
            <MetricCard label="In progress" value={orders.inProgress} />
            <MetricCard label="Awaiting payment" value={orders.awaitingPayment} />
            <MetricCard label="Cancelled" value={orders.cancelled} />
            <MetricCard label="Payment failures" value={orders.paymentFailures} tone={orders.paymentFailures > 0 ? "warning" : "default"} />
          </div>
        </SectionCard>

        {customers ? (
          <SectionCard title="Customers" actions={exportLink("customers", "Customers CSV")}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Registered customers" value={customers.registered} />
              <MetricCard label="Guest customers" value={customers.guests} hint="Distinct emails" />
              <MetricCard label="Repeat customers" value={customers.repeat} hint="2+ paid orders" />
              <MetricCard label="New registrations" value={customers.newRegistrations} hint="In this period" />
              <MetricCard label="New guests" value={customers.newGuests} hint="First order in this period" />
            </div>
          </SectionCard>
        ) : null}

        {inventory ? (
          <SectionCard title="Inventory" actions={<div className="flex gap-2">{exportLink("inventory", "Stock CSV")}{exportLink("adjustments", "Adjustments CSV")}</div>}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Active products" value={inventory.activeProducts} />
              <MetricCard label="Units on hand" value={inventory.unitsOnHand} />
              <MetricCard label="Adjustments" value={inventory.adjustments.count} hint={`+${inventory.adjustments.unitsAdded} / −${inventory.adjustments.unitsRemoved} units`} />
              <MetricCard label="Out of stock" value={inventory.out.length} tone={inventory.out.length > 0 ? "danger" : "default"} />
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-bold text-ink">Low stock</h3>
                <Table head={["Product", "Available", "Alert at"]} empty="Nothing is running low." rows={inventory.low.map((p) => [p.name, p.available, p.threshold])} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-ink">Out of stock</h3>
                <Table head={["Product"]} empty="Everything is in stock." rows={inventory.out.map((p) => [p.name])} />
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
