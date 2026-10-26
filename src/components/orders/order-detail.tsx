"use client";

import Link from "next/link";
import { useCallback } from "react";
import { ArrowLeft, SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AddressBlock } from "@/components/common/address-block";
import { ProductImage } from "@/components/common/product-image";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { DemoTag, OrderStatusBadge, PaymentStatusBadge } from "@/components/common/status-badge";
import { WhatsAppLink } from "@/components/common/whatsapp-link";
import { OrderSummary } from "@/components/cart/order-summary";
import { formatDateTime, formatINR } from "@/lib/formatters";
import { useServiceQuery } from "@/lib/hooks/use-service-query";
import { ORDER_STATUS_META, PAYMENT_METHOD_LABEL } from "@/lib/orders/status";
import { getOrderById } from "@/lib/services/orders";
import { OrderTimeline } from "./order-timeline";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-4">
      <h2 className="mb-3 text-base font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const fetcher = useCallback(() => getOrderById(orderId), [orderId]);
  const query = useServiceQuery(fetcher);

  if (query.status === "loading") return <ListSkeleton rows={3} rowClassName="h-40" />;
  if (query.status === "error") return <ErrorState onRetry={query.reload} />;

  const order = query.data;
  if (!order) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Order not found"
        description="We couldn't find that order. It may have been created on a different device."
        action={
          <Link href="/orders" className={buttonVariants({ size: "lg" })}>
            Back to My Orders
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-extrabold text-ink">{order.orderNumber}</h1>
          {order.isDemo ? <DemoTag /> : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Placed on {formatDateTime(order.createdAt)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{ORDER_STATUS_META[order.status].description}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <div className="space-y-4">
          <Section title="Status">
            <OrderTimeline order={order} />
          </Section>
          <Section title="Delivery address">
            <AddressBlock address={order.address} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Items">
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <ProductImage src={item.imageSrc} alt="" sizes="56px" className="w-14 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Qty {item.quantity} × {formatINR(item.unitPricePaise)}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-ink">{formatINR(item.lineTotalPaise)}</p>
                </li>
              ))}
            </ul>
            <OrderSummary totals={order} className="mt-4 border-t pt-4" />
          </Section>

          <Section title="Payment">
            <p className="mb-2 text-sm text-ink">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</p>
            <PaymentStatusBadge status={order.paymentStatus} />
          </Section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/orders"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All orders
        </Link>
        <WhatsAppLink orderNumber={order.orderNumber} label="Get help with this order" />
      </div>
    </div>
  );
}
