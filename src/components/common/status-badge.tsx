import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  type StatusTone,
} from "@/lib/orders/status";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-soft text-muted-foreground",
  info: "bg-brand-blue-soft text-brand-blue",
  progress: "bg-brand-yellow-soft text-[#7a5b00]",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-brand-yellow-soft text-[#7a5b00]",
};

function Pill({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-[0.65rem] font-bold tracking-wider text-muted-foreground uppercase",
        className,
      )}
    >
      Demo
    </span>
  );
}
