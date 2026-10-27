import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBadge } from "@/components/admin/admin-badge";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyRows, SectionCard, TableCard, TableScroll } from "@/components/admin/table-card";
import { OrderStatusBadge } from "@/components/common/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeValue } from "@/lib/admin/promotion-format";
import { formatDateTime } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import { getPromotionDetail } from "@/lib/server/admin/queries/promotions";
import { can, requireAdmin } from "@/lib/server/admin/session";
import type { OrderStatus } from "@/lib/types";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Coupon usage" };

export default async function PromotionDetailPage({ params }: PageProps<"/admin/promotions/[id]">) {
  const admin = await requireAdmin("promotions.read");
  const { id } = await params;
  const promo = await getPromotionDetail(admin, id);
  if (!promo) notFound();
  const canSeeOrders = can(admin, "orders.read");

  return (
    <>
      <PageHeader
        title={promo.code}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {describeValue(promo)}
            {promo.minOrderPaise > 0 ? <span>· min order {formatINR(promo.minOrderPaise)}</span> : null}
            <AdminBadge tone={promo.isActive ? "success" : "neutral"}>{promo.isActive ? "Active" : "Inactive"}</AdminBadge>
          </span>
        }
        actions={<Link href="/admin/promotions" className="text-sm font-semibold text-primary hover:underline">All coupons</Link>}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SectionCard title="Redemptions"><p className="text-2xl font-extrabold tabular-nums">{promo.uses}{promo.maxUses ? ` / ${promo.maxUses}` : ""}</p><p className="text-xs text-muted-foreground">Cancelled orders free their use.</p></SectionCard>
        <SectionCard title="Discount given"><p className="text-2xl font-extrabold tabular-nums">{formatINR(promo.discountGivenPaise)}</p></SectionCard>
        <SectionCard title="Per customer"><p className="text-2xl font-extrabold tabular-nums">{promo.maxUsesPerCustomer ?? "∞"}</p></SectionCard>
      </div>
      <TableCard>
        {promo.redemptions.length === 0 ? (
          <EmptyRows title="Not used yet" description="Orders that use this code will be listed here." />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Order status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promo.redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.at)}</TableCell>
                    <TableCell>{r.customer}</TableCell>
                    <TableCell>
                      {canSeeOrders ? <Link href={`/admin/orders/${r.orderId}`} className="font-mono text-sm font-semibold text-primary hover:underline">{r.orderNumber}</Link> : <span className="font-mono text-sm">{r.orderNumber}</span>}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatINR(r.discountPaise)}</TableCell>
                    <TableCell><OrderStatusBadge status={r.orderStatus as OrderStatus} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </TableCard>
    </>
  );
}
