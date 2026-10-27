import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBadge } from "@/components/admin/admin-badge";
import { CustomerProfileForm } from "@/components/admin/customer-profile-form";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard, TableCard, TableScroll } from "@/components/admin/table-card";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import { getCustomerDetail } from "@/lib/server/admin/queries/customers";
import { can, requireAdmin } from "@/lib/server/admin/session";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Customer" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-xs">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-ink tabular-nums">{value}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: PageProps<"/admin/customers/[id]">) {
  const admin = await requireAdmin("customers.read");
  const { id } = await params;
  const customer = await getCustomerDetail(admin, id);
  if (!customer) notFound();
  const canSeeOrders = can(admin, "orders.read");

  return (
    <>
      <PageHeader
        title={customer.name || "Customer"}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {customer.email}
            <AdminBadge tone={customer.type === "guest" ? "neutral" : "info"}>{customer.type === "guest" ? "Guest" : "Registered"}</AdminBadge>
          </span>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders" value={customer.orderCount} />
        <Stat label="Completed (delivered)" value={customer.completedOrders} />
        <Stat label="Net purchase value" value={formatINR(customer.purchaseValuePaise)} />
        <Stat label="Last order" value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <SectionCard title="Order history">
            {customer.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <TableCard className="border-0 shadow-none">
                <TableScroll>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Fulfilment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            {canSeeOrders ? (
                              <Link href={`/admin/orders/${order.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">{order.orderNumber}</Link>
                            ) : (
                              <span className="font-mono text-sm">{order.orderNumber}</span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(order.createdAt)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{formatINR(order.totalPaise)}</TableCell>
                          <TableCell><PaymentStatusBadge status={order.paymentStatus as PaymentStatus} /></TableCell>
                          <TableCell><OrderStatusBadge status={order.orderStatus as OrderStatus} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableScroll>
              </TableCard>
            )}
          </SectionCard>

          <SectionCard title={customer.type === "guest" ? "Latest delivery address (from their last order)" : "Saved addresses"}>
            {customer.type === "guest" ? (
              customer.lastAddress ? (
                <address className="text-sm leading-relaxed not-italic">
                  {customer.lastAddress.fullName}, {customer.lastAddress.line1}, {customer.lastAddress.area}, {customer.lastAddress.city}, {customer.lastAddress.state} {customer.lastAddress.pincode}
                </address>
              ) : (
                <p className="text-sm text-muted-foreground">No address on file.</p>
              )
            ) : customer.addresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved addresses.</p>
            ) : (
              <ul className="space-y-3">
                {customer.addresses.map((address) => (
                  <li key={address.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">
                      {address.fullName} {address.isDefault ? <AdminBadge tone="info">Default</AdminBadge> : null}
                    </p>
                    <p className="text-muted-foreground">{address.line1}, {address.area}, {address.city}, {address.state} {address.pincode}</p>
                    <p className="text-xs text-muted-foreground">Phone {address.mobile}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Contact">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="break-all text-ink">{customer.email}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Phone</dt><dd className="text-ink">{customer.phone || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Registered</dt><dd className="text-ink">{customer.registeredAt ? formatDate(customer.registeredAt) : "Not registered (guest)"}</dd></div>
            </dl>
          </SectionCard>
          {customer.type === "registered" ? (
            <SectionCard title="Profile corrections" description="Name and phone only. Sign-in details are managed by the customer.">
              <CustomerProfileForm userId={customer.id} fullName={customer.name} mobile={customer.phone} />
            </SectionCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
