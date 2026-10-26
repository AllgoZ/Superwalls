import { Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";
import { ORDER_STATUS_META, ORDER_TIMELINE } from "@/lib/orders/status";
import type { Order, OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Read-only status timeline. Steps come from the order's recorded status
 * history; customers cannot change status from the UI.
 */
export function OrderTimeline({ order }: { order: Order }) {
  const reachedAt = new Map<OrderStatus, string>(
    order.statusHistory.map((event) => [event.status, event.at]),
  );
  const cancelled = order.status === "cancelled";

  const steps: OrderStatus[] = cancelled
    ? [...ORDER_TIMELINE.filter((status) => reachedAt.has(status)), "cancelled"]
    : [...ORDER_TIMELINE];

  return (
    <ol className="space-y-0" aria-label="Order status timeline">
      {steps.map((status, index) => {
        const at = reachedAt.get(status);
        const reached = Boolean(at);
        const isCurrent = status === order.status;
        const isCancelledStep = status === "cancelled";
        const isLast = index === steps.length - 1;
        return (
          <li
            key={status}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 bottom-0 left-3.5 w-0.5 -translate-x-1/2",
                  reachedAt.has(steps[index + 1]) ? "bg-brand-blue" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                isCancelledStep && "border-danger bg-danger text-white",
                !isCancelledStep && reached && "border-brand-blue bg-brand-blue text-white",
                !reached && "border-border bg-white",
                isCurrent && !isCancelledStep && "ring-4 ring-brand-blue/15",
              )}
            >
              {isCancelledStep ? (
                <X className="size-3.5" aria-hidden />
              ) : reached ? (
                <Check className="size-3.5" aria-hidden />
              ) : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm font-semibold", reached ? "text-ink" : "text-muted-foreground")}>
                {ORDER_STATUS_META[status].label}
                {isCurrent ? <span className="sr-only"> (current status)</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {at ? formatDateTime(at) : "Pending"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
