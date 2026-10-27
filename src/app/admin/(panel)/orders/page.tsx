import Link from "next/link";
import { Download } from "lucide-react";
import { AdminBadge } from "@/components/admin/admin-badge";
import { FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { EmptyRows, TableCard, TableScroll } from "@/components/admin/table-card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/common/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import { listOrders, orderTabCounts } from "@/lib/server/admin/queries/orders";
import { can, requireAdmin } from "@/lib/server/admin/session";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Orders" };

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending_payment", label: "Pending payment" },
  { key: "placed", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "payment_failed", label: "Payment failed" },
  { key: "refunded", label: "Refunded" },
];

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const admin = await requireAdmin("orders.read");
  const params = await searchParams;
  const [data, counts] = await Promise.all([listOrders(admin, params), orderTabCounts(admin)]);
  const status = (Array.isArray(params.status) ? params.status[0] : params.status) ?? "all";

  const tabHref = (key: string) => {
    const next = new URLSearchParams();
    for (const [name, value] of Object.entries(params)) {
      const single = Array.isArray(value) ? value[0] : value;
      if (single && name !== "status" && name !== "page") next.set(name, single);
    }
    if (key !== "all") next.set("status", key);
    const text = next.toString();
    return text ? `/admin/orders?${text}` : "/admin/orders";
  };
  const exportQuery = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" && k !== "page" ? [[k, v]] : []))).toString();
  const filtered = Object.keys(params).some((key) => key !== "page");

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order, guest and registered. Payment status comes from verified payment events only."
        actions={
          can(admin, "orders.export") ? (
            <a href={`/api/admin/export/orders${exportQuery ? `?${exportQuery}` : ""}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download aria-hidden /> Export CSV
            </a>
          ) : null
        }
      />
      <TableCard>
        <div className="flex gap-1 overflow-x-auto border-b px-3 pt-2" role="tablist" aria-label="Order status">
          {TABS.map((tab) => {
            const active = status === tab.key;
            return (
              <Link
                key={tab.key}
                href={tabHref(tab.key)}
                role="tab"
                aria-selected={active}
                className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-ink")}
              >
                {tab.label}
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{counts[tab.key] ?? 0}</span>
              </Link>
            );
          })}
        </div>
        <FilterBar
          searchPlaceholder="Order no., name, phone or email"
          filters={[
            {
              key: "payment",
              label: "Payment status",
              options: [
                { value: "all", label: "Any payment" },
                { value: "paid", label: "Paid" },
                { value: "unpaid", label: "Pending / in progress" },
                { value: "failed", label: "Failed" },
                { value: "cancelled", label: "Cancelled" },
                { value: "refunded", label: "Refunded" },
              ],
            },
            { key: "type", label: "Customer type", options: [{ value: "all", label: "Guest & registered" }, { value: "guest", label: "Guest" }, { value: "registered", label: "Registered" }] },
          ]}
          dates={[{ key: "from", label: "From" }, { key: "to", label: "To" }]}
        />
        {data.rows.length === 0 ? (
          <EmptyRows title={filtered ? "No orders match these filters" : "No orders yet"} description={filtered ? "Try another status tab or clear the filters." : "Orders appear here as soon as customers check out."} />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Delivery</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Fulfilment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                      {order.refundRequired ? <AdminBadge tone="danger" className="ml-1.5">Refund due</AdminBadge> : null}
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium text-ink">{order.customerName}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {order.customerPhone}
                        <AdminBadge tone={order.customerType === "guest" ? "neutral" : "info"}>{order.customerType === "guest" ? "Guest" : "Registered"}</AdminBadge>
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{order.itemCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(order.subtotalPaise)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(order.deliveryPaise)}</TableCell>
                    <TableCell className="text-right tabular-nums">{order.discountPaise ? `−${formatINR(order.discountPaise)}` : "—"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatINR(order.totalPaise)}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={order.paymentStatus as PaymentStatus} />
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.orderStatus as OrderStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
        <Pagination page={data.page} pageSize={data.pageSize} total={data.total} basePath="/admin/orders" searchParams={params} />
      </TableCard>
    </>
  );
}
