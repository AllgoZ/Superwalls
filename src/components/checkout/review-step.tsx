"use client";

import { Loader2, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddressBlock } from "@/components/common/address-block";
import { ProductImage } from "@/components/common/product-image";
import { OrderSummary } from "@/components/cart/order-summary";
import { formatINR } from "@/lib/formatters";
import { getPaymentMethods } from "@/lib/services/payments";
import type { AddressFields, CartLine, CartTotals, PaymentMethodId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReviewStepProps {
  lines: CartLine[];
  totals: CartTotals;
  address: AddressFields;
  paymentMethod: PaymentMethodId;
  onPaymentMethodChange: (method: PaymentMethodId) => void;
  saveAddress: boolean;
  onSaveAddressChange: (value: boolean) => void;
  onEditAddress: () => void;
  onPlaceOrder: () => void;
  submitting: boolean;
  error: string | null;
}

export function ReviewStep({
  lines,
  totals,
  address,
  paymentMethod,
  onPaymentMethodChange,
  saveAddress,
  onSaveAddressChange,
  onEditAddress,
  onPlaceOrder,
  submitting,
  error,
}: ReviewStepProps) {
  const methods = getPaymentMethods();

  return (
    <div className="space-y-5 pb-36 md:grid md:grid-cols-[1fr_22rem] md:items-start md:gap-8 md:space-y-0 md:pb-0">
      <div className="space-y-5">
        <section aria-labelledby="items-heading" className="rounded-2xl border bg-white p-4">
          <h2 id="items-heading" className="mb-3 text-base font-bold text-ink">
            Your items
          </h2>
          <ul className="divide-y">
            {lines.map(({ product, quantity, lineTotalPaise }) => (
              <li key={product.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <ProductImage
                  src={product.images[0]?.src}
                  alt=""
                  sizes="56px"
                  className="w-14 shrink-0 rounded-lg"
                />
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
            <Button variant="ghost" size="sm" onClick={onEditAddress} className="text-brand-blue">
              <Pencil aria-hidden />
              Edit
              <span className="sr-only"> delivery address</span>
            </Button>
          </div>
          <AddressBlock address={address} />
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
        </section>

        <section aria-labelledby="payment-heading" className="rounded-2xl border bg-white p-4">
          <h2 id="payment-heading" className="mb-3 text-base font-bold text-ink">
            Payment method
          </h2>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(value) => onPaymentMethodChange(value as PaymentMethodId)}
            aria-labelledby="payment-heading"
          >
            {methods.map((method) => {
              const inputId = `payment-${method.id}`;
              return (
                <Label
                  key={method.id}
                  htmlFor={inputId}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 transition-colors",
                    method.enabled ? "cursor-pointer hover:bg-soft" : "cursor-not-allowed opacity-60",
                    paymentMethod === method.id && method.enabled && "border-brand-blue bg-brand-blue-soft/50",
                  )}
                >
                  <RadioGroupItem
                    id={inputId}
                    value={method.id}
                    disabled={!method.enabled}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">{method.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {method.enabled ? method.description : (method.unavailableReason ?? "Unavailable")}
                    </span>
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
        </section>
      </div>

      <aside
        aria-label="Order total"
        className="rounded-2xl border bg-white p-4 md:sticky md:top-24"
      >
        <h2 className="mb-3 text-base font-bold text-ink">Order summary</h2>
        <OrderSummary totals={totals} />

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 pt-3 pb-3 md:static md:mt-4 md:border-0 md:p-0">
          <div className="mb-2 flex items-baseline justify-between md:hidden">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-extrabold tabular-nums text-ink">{formatINR(totals.totalPaise)}</span>
          </div>
          <Button size="lg" className="w-full" onClick={onPlaceOrder} disabled={submitting} aria-busy={submitting}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Placing order…
              </>
            ) : (
              <>
                <Lock aria-hidden />
                Place Order · {formatINR(totals.totalPaise)}
              </>
            )}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Demo checkout: no real order is created and no payment is taken.
          </p>
        </div>
      </aside>
    </div>
  );
}
