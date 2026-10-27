import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/common/status-badge";
import { formatDate, formatINR } from "@/lib/formatters";
import type { Order } from "@/lib/types";

function summarizeItems(order: Order): string {
  const [first, ...rest] = order.items;
  if (!first) return "No items";
  const head = `${first.name} × ${first.quantity}`;
  return rest.length === 0 ? head : `${head} + ${rest.length} more ${rest.length === 1 ? "item" : "items"}`;
}

export function OrderCard({ order }: { order: Order }) {
  return (
    <article className="rounded-2xl border bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
            <span className="truncate">{order.orderNumber}</span>
          </h2>
          <p className="text-xs text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <p className="text-base font-extrabold tabular-nums text-ink">{formatINR(order.totalPaise)}</p>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-ink">{summarizeItems(order)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.paymentStatus} />
      </div>

      <Link
        href={`/orders/${encodeURIComponent(order.orderNumber)}`}
        className="mt-4 flex min-h-11 items-center justify-between rounded-xl bg-brand-blue-soft px-4 text-sm font-semibold text-brand-blue transition-colors hover:bg-brand-blue-soft/70"
      >
        <span>
          View Details<span className="sr-only"> for order {order.orderNumber}</span>
        </span>
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </article>
  );
}
