"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hourglass, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import {
  readPendingCheckout,
  writePendingCheckout,
  type PendingCheckout,
} from "@/lib/checkout/local-state";
import { generateId } from "@/lib/id";
import { useBuyNow } from "@/lib/hooks/use-buy-now";
import { useCart } from "@/lib/hooks/use-cart";
import { useServiceQuery } from "@/lib/hooks/use-service-query";
import { useProfile, useSession } from "@/lib/hooks/use-session";
import { getAddresses, saveAddress } from "@/lib/services/addresses";
import { previewCoupon, startCheckout, type CouponPreview } from "@/lib/services/checkout";
import { ServiceError, toErrorMessage } from "@/lib/services/errors";
import type { DeliveryFormValues } from "@/lib/validation/schemas";
import { DeliveryStep, EMPTY_DELIVERY } from "./delivery-step";
import { ReviewStep, type PayError, type PayPhase } from "./review-step";
import { CheckoutStepper, type CheckoutStepId } from "./stepper";

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Small non-cryptographic hash: only used to tell whether the basket / contact / address changed. */
function fingerprintOf(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
}

interface CheckoutFlowProps {
  /** "cart" checks out the whole cart; "buy" checks out only the Buy Now item and leaves the cart alone. */
  mode?: "cart" | "buy";
}

/**
 * Steps 1-2 of checkout (delivery, review & pay). Step 3 (confirmation) is `/checkout/return`, which only
 * shows success after the SERVER has verified the payment. Nothing here clears the cart.
 */
export function CheckoutFlow({ mode = "cart" }: CheckoutFlowProps) {
  const cartState = useCart();
  const buyNowState = useBuyNow();
  const cart = mode === "buy" ? buyNowState : cartState;
  const session = useSession();
  const addresses = useServiceQuery(getAddresses);
  const profile = useProfile();

  const [step, setStep] = useState<Exclude<CheckoutStepId, "confirmation">>("delivery");
  const [delivery, setDelivery] = useState<DeliveryFormValues | null>(null);
  const [shouldSaveAddress, setShouldSaveAddress] = useState(true);
  const [phase, setPhase] = useState<PayPhase>("idle");
  const [error, setError] = useState<PayError | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);

  // A ref-based lock closes the gap between a click and the re-render that disables the button.
  const payLock = useRef(false);

  useEffect(() => {
    // Read after mount so server and first client render match.
    const stored = readPendingCheckout();
    if (stored?.orderNumber) setPending(stored); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const goTo = useCallback((next: "delivery" | "review") => {
    setStep(next);
    scrollToTop();
  }, []);

  const signedIn = session.data?.signedIn === true;

  const pay = useCallback(async () => {
    if (payLock.current || !delivery) return;
    payLock.current = true;
    setPhase("creating");
    setError(null);

    try {
      const { email, ...address } = delivery;
      const items = cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity }));

      // One idempotency key per (basket + contact + address). Retrying the same checkout reuses it, so the
      // server resolves to the same order; changing anything starts a fresh one.
      const fingerprint = fingerprintOf({ mode, items, email, address, coupon: coupon?.code ?? null });
      const stored = readPendingCheckout();
      const idempotencyKey = stored && stored.fingerprint === fingerprint ? stored.idempotencyKey : generateId("co");
      writePendingCheckout({ mode, fingerprint, idempotencyKey, startedAt: new Date().toISOString() });

      const response = await startCheckout({ idempotencyKey, email, address, items, couponCode: coupon?.code });
      writePendingCheckout({
        mode,
        fingerprint,
        idempotencyKey,
        orderNumber: response.orderNumber,
        startedAt: new Date().toISOString(),
      });

      // Saving the address is best-effort and must never fail the checkout.
      const alreadySaved = (addresses.data ?? []).some(
        (saved) => saved.line1 === address.line1 && saved.pincode === address.pincode,
      );
      if (signedIn && shouldSaveAddress && !alreadySaved) saveAddress(address).catch(() => undefined);

      // The cart is deliberately left alone: it is cleared only once the server confirms payment.
      setRedirectUrl(response.payment.action.url);
      setPhase("redirecting");
      window.location.assign(response.payment.action.url);
    } catch (caught) {
      const message = toErrorMessage(caught);
      setError({ code: caught instanceof ServiceError ? caught.code : "UNKNOWN", message });
      // The server re-checks the coupon at payment time; if it refused, stop showing a discount that won't apply.
      if (coupon && /coupon/i.test(message)) setCoupon(null);
      toast.error(message);
      setPhase("idle");
      if (caught instanceof ServiceError && (caught.code === "OUT_OF_STOCK" || caught.code === "PRICE_CHANGED")) {
        cart.reload(); // show the customer the current stock and prices
      }
      payLock.current = false;
    }
  }, [addresses.data, cart, coupon, delivery, mode, shouldSaveAddress, signedIn]);

  const applyCoupon = useCallback(
    async (code: string) => {
      const items = cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity }));
      setCoupon(await previewCoupon(code, items, delivery?.email));
    },
    [cart.lines, delivery?.email],
  );

  if (cart.status === "loading") {
    return <ListSkeleton rows={3} />;
  }
  if (cart.status === "error") {
    return <ErrorState onRetry={cart.reload} />;
  }
  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title="Nothing to check out yet"
        description={
          mode === "buy"
            ? "Pick a product and tap Buy Now to start."
            : "Your cart is empty. Add a product to get started."
        }
        action={
          <Link href="/#products" className={buttonVariants({ size: "lg" })}>
            Continue Shopping
          </Link>
        }
      />
    );
  }

  const prefillReady = session.status !== "loading" && addresses.status !== "loading" && profile.status !== "loading";
  const defaultAddress = signedIn ? (addresses.data?.find((address) => address.isDefault) ?? addresses.data?.[0]) : undefined;
  const email = signedIn ? (profile.data?.email ?? session.data?.email ?? "") : "";
  const initialValues: DeliveryFormValues =
    delivery ??
    (defaultAddress
      ? {
          fullName: defaultAddress.fullName,
          mobile: defaultAddress.mobile,
          line1: defaultAddress.line1,
          area: defaultAddress.area,
          city: defaultAddress.city,
          state: defaultAddress.state,
          pincode: defaultAddress.pincode,
          instructions: defaultAddress.instructions ?? "",
          email,
        }
      : { ...EMPTY_DELIVERY, email, fullName: signedIn ? (profile.data?.fullName ?? "") : "", mobile: signedIn ? (profile.data?.mobile ?? "") : "" });

  return (
    <div className="space-y-6">
      <CheckoutStepper current={step} />

      {pending?.orderNumber ? (
        <div className="flex items-start gap-3 rounded-2xl bg-brand-yellow-soft px-4 py-3 text-sm text-ink">
          <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            You started a payment for order <strong>{pending.orderNumber}</strong>. If you already paid, don&apos;t pay again.{" "}
            <Link
              href={`/checkout/return?order=${encodeURIComponent(pending.orderNumber)}`}
              className="font-semibold text-brand-blue underline"
            >
              Check payment status
            </Link>
          </p>
        </div>
      ) : null}

      {step === "delivery" ? (
        prefillReady ? (
          <div className="pb-24 md:pb-0">
            <DeliveryStep
              key={signedIn ? `u-${defaultAddress?.id ?? "none"}` : "guest"}
              initialValues={initialValues}
              signedIn={signedIn}
              savedAddresses={signedIn ? (addresses.data ?? []) : []}
              loginNext={mode === "buy" ? "/buy" : "/checkout"}
              onSubmit={(values) => {
                setDelivery(values);
                goTo("review");
              }}
            />
          </div>
        ) : (
          <ListSkeleton rows={4} rowClassName="h-16" />
        )
      ) : delivery ? (
        <ReviewStep
          lines={cart.lines}
          totals={
            coupon
              ? {
                  ...cart.totals,
                  // The server's number replaces any automatic discount; the total is recomputed from it.
                  discountPaise: coupon.discountPaise,
                  totalPaise: Math.max(0, cart.totals.subtotalPaise - coupon.discountPaise + cart.totals.deliveryPaise),
                }
              : cart.totals
          }
          address={delivery}
          email={delivery.email}
          canSaveAddress={signedIn}
          saveAddress={shouldSaveAddress}
          onSaveAddressChange={setShouldSaveAddress}
          onEditAddress={() => goTo("delivery")}
          onPay={pay}
          phase={phase}
          error={error}
          redirectUrl={redirectUrl}
          coupon={coupon}
          onApplyCoupon={applyCoupon}
          onRemoveCoupon={() => setCoupon(null)}
        />
      ) : null}
    </div>
  );
}
