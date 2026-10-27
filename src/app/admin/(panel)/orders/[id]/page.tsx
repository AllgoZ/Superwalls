import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import { AdminBadge } from "@/components/admin/admin-badge";
import { OrderActions, OrderNoteForm } from "@/components/admin/order-actions";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/table-card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/common/status-badge";
import { formatDateTime } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import { getOrderDetail } from "@/lib/server/admin/queries/orders";
import { can, requireAdmin } from "@/lib/server/admin/session";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Order" };

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 text-sm ${strong ? "border-t pt-2 text-base font-extrabold text-ink" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const admin = await requireAdmin("orders.read");
  const { id } = await params;
  const order = await getOrderDetail(admin, id);
  if (!order) notFound();
  const a = order.address;
  const showCustomerLink = can(admin, "customers.read");

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Placed {formatDateTime(order.createdAt)}
            <OrderStatusBadge status={order.orderStatus as OrderStatus} />
            <PaymentStatusBadge status={order.paymentStatus as PaymentStatus} />
            {order.refundRequired ? <AdminBadge tone="danger">Refund required</AdminBadge> : null}
          </span>
        }
        actions={<OrderActions orderId={order.id} orderStatus={order.orderStatus} paymentStatus={order.paymentStatus} />}
      />

      {order.refundRequired ? (
        <p role="note" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          This order is flagged for a refund. Nothing has been refunded yet: refunds are issued through the payment gateway, which isn&apos;t connected in this phase.
        </p>
      ) : null}
      {order.cancelReason ? (
        <p role="note" className="mb-4 rounded-lg bg-muted px-4 py-3 text-sm">
          <span className="font-semibold text-ink">Cancelled:</span> {order.cancelReason}
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <SectionCard title={`Items (${order.items.reduce((n, i) => n + i.quantity, 0)})`}>
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                    {item.imageSrc ? <Image src={item.imageSrc} alt="" fill unoptimized sizes="56px" className="object-cover" /> : <ImageOff className="m-4 size-6 text-muted-foreground" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${item.productId}`} className="block truncate text-sm font-semibold text-ink hover:text-primary hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.sku ? `SKU ${item.sku} · ` : ""}{formatINR(item.unitPricePaise)} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatINR(item.lineTotalPaise)}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Payment & totals">
            <dl>
              <Row label="Subtotal" value={formatINR(order.subtotalPaise)} />
              <Row label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"} value={order.discountPaise ? `−${formatINR(order.discountPaise)}` : "—"} />
              <Row label="Delivery" value={order.deliveryPaise ? formatINR(order.deliveryPaise) : "Free"} />
              <Row label="Total" value={formatINR(order.totalPaise)} strong />
              {order.refundedPaise > 0 ? <Row label="Refunded" value={formatINR(order.refundedPaise)} /> : null}
            </dl>
            <dl className="mt-4 border-t pt-3">
              <Row label="Payment status" value={<PaymentStatusBadge status={order.paymentStatus as PaymentStatus} />} />
              <Row label="Provider" value={order.paymentProvider ?? "—"} />
              <Row label="Reference" value={<span className="font-mono text-xs break-all">{order.paymentReference ?? "—"}</span>} />
              <Row label="Paid at" value={order.paidAt ? formatDateTime(order.paidAt) : "—"} />
            </dl>
            {order.payments.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Attempt</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      <th className="px-3 py-2 font-semibold">Provider reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-3 py-2">{formatDateTime(payment.createdAt)}</td>
                        <td className="px-3 py-2">
                          {payment.status}
                          {payment.refundRequired ? " · refund due" : ""}
                          {payment.failureReason ? ` · ${payment.failureReason.replace(/_/g, " ")}` : ""}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatINR(payment.amountPaise)}</td>
                        <td className="px-3 py-2 font-mono break-all">{payment.providerPaymentId ?? payment.providerOrderId ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground print:hidden">Payment status can only change through verified payment events. It cannot be edited here.</p>
          </SectionCard>

          <SectionCard title="Internal notes" description="Visible to staff only.">
            <div className="space-y-4">
              <OrderNoteForm orderId={order.id} />
              {order.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {order.notes.map((note) => (
                    <li key={note.id} className="rounded-lg bg-muted px-3 py-2">
                      <p className="text-sm whitespace-pre-wrap text-ink">{note.note}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{note.by} · {formatDateTime(note.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Customer">
            <p className="text-sm font-semibold text-ink">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
            <p className="text-sm break-all text-muted-foreground">{order.customerEmail}</p>
            <p className="mt-2 flex items-center gap-2">
              <AdminBadge tone={order.customerType === "guest" ? "neutral" : "info"}>{order.customerType === "guest" ? "Guest checkout" : "Registered customer"}</AdminBadge>
              {showCustomerLink ? (
                <Link href={`/admin/customers/${order.customerId}`} className="text-xs font-semibold text-primary hover:underline print:hidden">
                  View customer
                </Link>
              ) : null}
            </p>
          </SectionCard>

          <SectionCard title="Delivery address">
            <address className="text-sm leading-relaxed text-ink not-italic">
              {a.fullName}
              <br />
              {a.line1}
              <br />
              {a.area}
              <br />
              {a.city}, {a.state} {a.pincode}
              <br />
              <span className="text-muted-foreground">Phone {a.mobile}</span>
            </address>
            {a.instructions ? (
              <p className="mt-2 rounded-lg bg-brand-yellow-soft px-3 py-2 text-xs text-[#7a5b00]">
                <span className="font-semibold">Delivery instructions:</span> {a.instructions}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Order history">
            <OrderTimeline entries={order.timeline} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
