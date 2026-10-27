"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { AddressBlock } from "@/components/common/address-block";
import { ProductImage } from "@/components/common/product-image";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/common/status-badge";
import { WhatsAppLink } from "@/components/common/whatsapp-link";
import { OrderSummary } from "@/components/cart/order-summary";
import { formatDateTime, formatINR } from "@/lib/formatters";
import { useServiceQuery } from "@/lib/hooks/use-service-query";
import { canRetryPayment, ORDER_STATUS_META, PAYMENT_METHOD_LABEL } from "@/lib/orders/status";
import { retryPayment } from "@/lib/services/checkout";
import { toErrorMessage } from "@/lib/services/errors";
import { getOrderByNumber } from "@/lib/services/orders";
import type { Order } from "@/lib/types";
import { OrderTimeline } from "./order-timeline";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-4">
      <h2 className="mb-3 text-base font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Presentational order page. Used for signed-in orders and for guest tracking alike. */
export function OrderView({ order, onRefresh, showBack = false }: { order: Order; onRefresh?: () => void; showBack?: boolean }) {
  const [retrying, setRetrying] = useState(false);

  async function onRetry() {
    setRetrying(true);
    try {
      const response = await retryPayment(order.orderNumber);
      window.location.assign(response.payment.action.url);
    } catch (error) {
      toast.error(toErrorMessage(error));
      setRetrying(false);
    }
  }

  const unpaid = canRetryPayment(order);

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-extrabold text-ink">{order.orderNumber}</h1>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">Placed on {formatDateTime(order.createdAt)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{ORDER_STATUS_META[order.status].description}</p>
        {unpaid ? (
          <div className="mt-3 flex flex-col gap-2 rounded-xl bg-brand-yellow-soft p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">This order isn&apos;t paid yet ({formatINR(order.totalPaise)}).</p>
            <Button onClick={onRetry} disabled={retrying} aria-busy={retrying}>
              {retrying ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {order.paymentStatus === "failed" || order.paymentStatus === "cancelled" ? "Retry payment" : "Complete payment"}
            </Button>
          </div>
        ) : null}
        {onRefresh ? (
          <Button variant="ghost" size="sm" className="mt-2 text-brand-blue" onClick={onRefresh}>
            <RefreshCw aria-hidden />
            Refresh status
          </Button>
        ) : null}
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
            <p className="mb-2 text-sm text-ink">{PAYMENT_METHOD_LABEL}</p>
            <PaymentStatusBadge status={order.paymentStatus} />
          </Section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {showBack ? (
          <Link
            href="/orders"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            All orders
          </Link>
        ) : (
          <span />
        )}
        <WhatsAppLink orderNumber={order.orderNumber} label="Get help with this order" />
      </div>
    </div>
  );
}

export function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const fetcher = useCallback(() => getOrderByNumber(orderNumber), [orderNumber]);
  const query = useServiceQuery(fetcher);

  if (query.status === "loading") return <ListSkeleton rows={3} rowClassName="h-40" />;
  if (query.status === "error") return <ErrorState onRetry={query.reload} />;

  const order = query.data;
  if (!order) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="Order not found"
        description="We couldn't find that order here. If you ordered as a guest on another device, use your private tracking link or the Track page."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/track" className={buttonVariants({ size: "lg" })}>
              Track an order
            </Link>
            <Link href="/orders" className={buttonVariants({ size: "lg", variant: "outline" })}>
              My orders
            </Link>
          </div>
        }
      />
    );
  }

  return <OrderView order={order} onRefresh={query.reload} showBack />;
}
