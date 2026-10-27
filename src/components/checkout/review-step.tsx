"use client";

import { AlertTriangle, Loader2, Lock, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AddressBlock } from "@/components/common/address-block";
import { ProductImage } from "@/components/common/product-image";
import { OrderSummary } from "@/components/cart/order-summary";
import { formatINR } from "@/lib/formatters";
import type { CouponPreview } from "@/lib/services/checkout";
import { CouponBox } from "./coupon-box";
import type { ServiceErrorCode } from "@/lib/services/errors";
import type { AddressFields, CartLine, CartTotals } from "@/lib/types";

export type PayPhase = "idle" | "creating" | "redirecting";

export interface PayError {
  code: ServiceErrorCode;
  message: string;
}

interface ReviewStepProps {
  lines: CartLine[];
  totals: CartTotals;
  address: AddressFields;
  email: string;
  /** Only registered customers can keep a saved address. */
  canSaveAddress: boolean;
  saveAddress: boolean;
  onSaveAddressChange: (value: boolean) => void;
  onEditAddress: () => void;
  onPay: () => void;
  phase: PayPhase;
  error: PayError | null;
  /** Shown while redirecting, in case the automatic redirect is blocked. */
  redirectUrl: string | null;
  coupon: CouponPreview | null;
  onApplyCoupon: (code: string) => Promise<void>;
  onRemoveCoupon: () => void;
}

export function ReviewStep({
  lines,
  totals,
  address,
  email,
  canSaveAddress,
  saveAddress,
  onSaveAddressChange,
  onEditAddress,
  onPay,
  phase,
  error,
  redirectUrl,
  coupon,
  onApplyCoupon,
  onRemoveCoupon,
}: ReviewStepProps) {
  const busy = phase !== "idle";
  const notConfigured = error?.code === "PAYMENT_NOT_CONFIGURED" || error?.code === "BACKEND_NOT_CONFIGURED";

  return (
    <div className="space-y-5 pb-40 md:grid md:grid-cols-[1fr_22rem] md:items-start md:gap-8 md:space-y-0 md:pb-0">
      <div className="space-y-5">
        <section aria-labelledby="items-heading" className="rounded-2xl border bg-white p-4">
          <h2 id="items-heading" className="mb-3 text-base font-bold text-ink">
            Your items
          </h2>
          <ul className="divide-y">
            {lines.map(({ product, quantity, lineTotalPaise }) => (
              <li key={product.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <ProductImage src={product.images[0]?.src} alt="" sizes="56px" className="w-14 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold text-ink">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Qty {quantity} × {formatINR(product.pricePaise)}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums text-ink">{formatINR(lineTotalPaise)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="address-heading" className="rounded-2xl border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="address-heading" className="text-base font-bold text-ink">
              Delivering to
            </h2>
            <Button variant="ghost" size="sm" onClick={onEditAddress} disabled={busy} className="text-brand-blue">
              <Pencil aria-hidden />
              Edit
              <span className="sr-only"> delivery details</span>
            </Button>
          </div>
          <AddressBlock address={address} />
          <p className="mt-2 text-sm text-muted-foreground">Confirmation to {email}</p>
          {canSaveAddress ? (
            <div className="mt-3 flex items-center gap-2.5">
              <Checkbox
                id="save-address"
                checked={saveAddress}
                onCheckedChange={(checked) => onSaveAddressChange(checked === true)}
              />
              <Label htmlFor="save-address" className="text-sm text-ink">
                Save this address for next time
              </Label>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="payment-heading" className="rounded-2xl border bg-white p-4">
          <h2 id="payment-heading" className="mb-2 text-base font-bold text-ink">
            Payment
          </h2>
          <div className="flex items-start gap-3 rounded-xl border border-brand-blue bg-brand-blue-soft/50 p-3.5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-ink">Pay online (UPI / cards / netbanking)</p>
              <p className="text-xs text-muted-foreground">
                You&apos;ll complete payment on a secure page. Your order is confirmed only after we verify the payment.
              </p>
            </div>
          </div>
        </section>
      </div>

      <aside aria-label="Order total" className="rounded-2xl border bg-white p-4 md:sticky md:top-24">
        <h2 className="mb-3 text-base font-bold text-ink">Order summary</h2>
        <CouponBox applied={coupon} onApply={onApplyCoupon} onRemove={onRemoveCoupon} disabled={busy} />
        <OrderSummary totals={totals} discountLabel={coupon ? `Coupon ${coupon.code}` : undefined} />

        {error ? (
          <div
            role="alert"
            className={`mt-4 flex gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
              notConfigured ? "bg-brand-yellow-soft text-ink" : "bg-danger-soft text-danger"
            }`}
          >
            {notConfigured ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
            <span>{error.message}</span>
          </div>
        ) : null}

        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 pt-3 pb-3 md:static md:mt-4 md:border-0 md:p-0">
          <div className="mb-2 flex items-baseline justify-between md:hidden">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-extrabold tabular-nums text-ink">{formatINR(totals.totalPaise)}</span>
          </div>
          <Button size="lg" className="w-full" onClick={onPay} disabled={busy} aria-busy={busy}>
            {phase === "creating" ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Preparing payment…
              </>
            ) : phase === "redirecting" ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Taking you to payment…
              </>
            ) : (
              <>
                <Lock aria-hidden />
                Pay {formatINR(totals.totalPaise)}
              </>
            )}
          </Button>
          {phase === "redirecting" && redirectUrl ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Not redirected?{" "}
              <a href={redirectUrl} className="font-semibold text-brand-blue underline">
                Continue to payment
              </a>
            </p>
          ) : (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Your cart stays saved until payment is confirmed.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
