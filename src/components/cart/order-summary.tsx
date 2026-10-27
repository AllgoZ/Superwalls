import { commerceConfig } from "@/lib/config/commerce";
import { formatINR } from "@/lib/formatters";
import type { CartTotals } from "@/lib/types";
import { cn } from "@/lib/utils";

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold tabular-nums text-ink", tone === "success" && "text-success")}>
        {value}
      </dd>
    </div>
  );
}

/** Subtotal / discount / delivery / total. Shared by the cart, checkout review and confirmation. */
export function OrderSummary({
  totals,
  discountLabel,
  className,
}: {
  totals: Pick<CartTotals, "subtotalPaise" | "discountPaise" | "deliveryPaise" | "totalPaise">;
  /** Names the discount line, for example "Coupon SAVE10". */
  discountLabel?: string;
  className?: string;
}) {
  return (
    <dl className={cn("space-y-2.5", className)}>
      <Row label="Subtotal" value={formatINR(totals.subtotalPaise)} />
      {totals.discountPaise > 0 ? (
        <Row
          label={discountLabel ?? commerceConfig.discount?.label ?? "Discount"}
          value={`−${formatINR(totals.discountPaise)}`}
          tone="success"
        />
      ) : null}
      <Row
        label="Delivery"
        value={totals.deliveryPaise === 0 ? "Free" : formatINR(totals.deliveryPaise)}
        tone={totals.deliveryPaise === 0 ? "success" : undefined}
      />
      <div className="flex items-center justify-between border-t pt-3">
        <dt className="text-base font-bold text-ink">Total</dt>
        <dd className="text-lg font-extrabold tabular-nums text-ink">{formatINR(totals.totalPaise)}</dd>
      </div>
    </dl>
  );
}
