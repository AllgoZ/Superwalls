"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { generateId } from "@/lib/id";
import { useBuyNow } from "@/lib/hooks/use-buy-now";
import { useCart } from "@/lib/hooks/use-cart";
import { useProfile } from "@/lib/hooks/use-session";
import { useServiceQuery } from "@/lib/hooks/use-service-query";
import { getAddresses, saveAddress } from "@/lib/services/addresses";
import { toErrorMessage } from "@/lib/services/errors";
import { createOrder } from "@/lib/services/orders";
import { getEnabledPaymentMethods } from "@/lib/services/payments";
import { useBuyNowStore } from "@/lib/stores/buy-now-store";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Order, PaymentMethodId } from "@/lib/types";
import type { AddressFormValues } from "@/lib/validation/schemas";
import { ConfirmationStep } from "./confirmation-step";
import { DeliveryStep, EMPTY_ADDRESS } from "./delivery-step";
import { ReviewStep } from "./review-step";
import { CheckoutStepper, type CheckoutStepId } from "./stepper";

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

interface CheckoutFlowProps {
  /** "cart" checks out the whole cart; "buy" checks out only the Buy Now item and leaves the cart alone. */
  mode?: "cart" | "buy";
}

export function CheckoutFlow({ mode = "cart" }: CheckoutFlowProps) {
  const cartState = useCart();
  const buyNowState = useBuyNow();
  const cart = mode === "buy" ? buyNowState : cartState;
  const addresses = useServiceQuery(getAddresses);
  const profile = useProfile();
  const clearCart = useCartStore((state) => state.clear);
  const clearBuyNow = useBuyNowStore((state) => state.clear);

  const [step, setStep] = useState<CheckoutStepId>("delivery");
  const [delivery, setDelivery] = useState<AddressFormValues | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(
    () => getEnabledPaymentMethods()[0]?.id ?? "cod",
  );
  const [shouldSaveAddress, setShouldSaveAddress] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A ref-based lock closes the gap between a click and the re-render that disables the button.
  const submitLock = useRef(false);
  // One idempotency key per checkout session: a retry after a failure can never create a second order.
  const requestId = useRef<string | null>(null);

  const goTo = useCallback((next: CheckoutStepId) => {
    setStep(next);
    scrollToTop();
  }, []);

  const placeOrder = useCallback(async () => {
    if (submitLock.current || !delivery) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);

    try {
      requestId.current ??= generateId("req");
      const created = await createOrder({
        items: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        address: delivery,
        paymentMethod,
        clientRequestId: requestId.current,
      });

      // The order exists now; saving the address is best-effort and must not fail the checkout.
      const alreadySaved = (addresses.data ?? []).some(
        (saved) => saved.line1 === delivery.line1 && saved.pincode === delivery.pincode,
      );
      if (shouldSaveAddress && !alreadySaved) {
        saveAddress(delivery).catch(() => undefined);
      }

      if (mode === "buy") clearBuyNow();
      else clearCart();
      setOrder(created);
      goTo("confirmation");
    } catch (caught) {
      const message = toErrorMessage(caught);
      setError(message);
      toast.error(message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [addresses.data, cart.lines, clearBuyNow, clearCart, delivery, goTo, mode, paymentMethod, shouldSaveAddress]);

  if (step === "confirmation" && order) {
    return (
      <div className="space-y-6">
        <CheckoutStepper current="confirmation" />
        <ConfirmationStep order={order} />
      </div>
    );
  }

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

  const prefillReady = addresses.status !== "loading" && profile.status !== "loading";
  const defaultAddress = addresses.data?.find((address) => address.isDefault) ?? addresses.data?.[0];
  const initialValues: AddressFormValues =
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
        }
      : {
          ...EMPTY_ADDRESS,
          fullName: profile.data?.fullName ?? "",
          mobile: profile.data?.mobile ?? "",
        });

  return (
    <div className="space-y-6">
      <CheckoutStepper current={step} />

      {step === "delivery" ? (
        prefillReady ? (
          <div className="pb-24 md:pb-0">
            <DeliveryStep
              initialValues={initialValues}
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
          totals={cart.totals}
          address={delivery}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
          saveAddress={shouldSaveAddress}
          onSaveAddressChange={setShouldSaveAddress}
          onEditAddress={() => goTo("delivery")}
          onPlaceOrder={placeOrder}
          submitting={submitting}
          error={error}
        />
      ) : null}
    </div>
  );
}
