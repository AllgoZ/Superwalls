"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, Hourglass, Loader2, RefreshCw, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { clearPendingCheckout, readPendingCheckout } from "@/lib/checkout/local-state";
import { formatINR } from "@/lib/formatters";
import { canRetryPayment } from "@/lib/orders/status";
import { retryPayment } from "@/lib/services/checkout";
import { toErrorMessage } from "@/lib/services/errors";
import { getOrderByNumber } from "@/lib/services/orders";
import { useBuyNowStore } from "@/lib/stores/buy-now-store";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Order } from "@/lib/types";
import { ConfirmationStep } from "./confirmation-step";
import { CheckoutStepper } from "./stepper";

const POLL_MS = 2500;
const POLL_WINDOW_MS = 90_000;

type View =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "missing" }
  | { kind: "order"; order: Order; timedOut: boolean };

/**
 * Step 3. Landing here from a payment page proves nothing: this asks the SERVER for the order and only shows
 * success when it reports the payment as verified. Until then it shows a pending state, and failure shows a
 * Retry Payment action that reuses the same order.
 */
export function PaymentReturn({ orderNumber }: { orderNumber: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [retrying, setRetrying] = useState(false);
  const [tick, setTick] = useState(0);
  const startedAt = useRef(0);
  const cleaned = useRef(false);

  const load = useCallback(async () => {
    if (!startedAt.current) startedAt.current = Date.now();
    try {
      const order = await getOrderByNumber(orderNumber);
      if (!order) {
        setView({ kind: "missing" });
        return "settled" as const;
      }
      const waiting = order.paymentStatus === "pending" || order.paymentStatus === "initiated";
      const timedOut = waiting && Date.now() - startedAt.current > POLL_WINDOW_MS;
      setView({ kind: "order", order, timedOut });
      return waiting && !timedOut ? ("poll" as const) : ("settled" as const);
    } catch {
      setView((current) => (current.kind === "order" ? current : { kind: "error" }));
      return "settled" as const;
    }
  }, [orderNumber]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      const outcome = await load();
      if (!cancelled && outcome === "poll") timer = setTimeout(run, POLL_MS);
    };
    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load, tick]);

  const paidOrder = view.kind === "order" && view.order.paymentStatus === "paid" ? view.order : null;

  // The basket is emptied only now, after the server has confirmed the payment.
  useEffect(() => {
    if (!paidOrder || cleaned.current) return;
    cleaned.current = true;
    const pending = readPendingCheckout();
    if (pending && (!pending.orderNumber || pending.orderNumber === paidOrder.orderNumber)) {
      if (pending.mode === "buy") useBuyNowStore.getState().clear();
      else useCartStore.getState().clear();
    }
    clearPendingCheckout();
  }, [paidOrder]);

  async function onRetry() {
    setRetrying(true);
    try {
      const response = await retryPayment(orderNumber);
      window.location.assign(response.payment.action.url);
    } catch (error) {
      toast.error(toErrorMessage(error));
      setRetrying(false);
    }
  }

  if (view.kind === "loading") return <ListSkeleton rows={3} />;
  if (view.kind === "error") return <ErrorState title="We couldn't check your payment" onRetry={() => setTick((n) => n + 1)} />;
  if (view.kind === "missing") {
    return (
      <EmptyState
        icon={<SearchX />}
        title="We couldn't find that order"
        description="If you just paid, it can take a moment to appear. Open this page on the device you used to order, or track it with your tracking link."
        action={
          <Link href="/track" className={buttonVariants({ size: "lg" })}>
            Track an order
          </Link>
        }
      />
    );
  }

  const { order, timedOut } = view;

  if (paidOrder) {
    return (
      <div className="space-y-6">
        <CheckoutStepper current="confirmation" />
        <ConfirmationStep order={paidOrder} />
      </div>
    );
  }

  if (order.status === "cancelled") {
    return (
      <StatusCard
        tone="danger"
        icon={<CircleAlert className="size-8" aria-hidden />}
        title="This order was cancelled"
        body={`Order ${order.orderNumber} wasn't completed, and you haven't been charged for it. You can place a new order any time.`}
      >
        <Link href="/#products" className={buttonVariants({ size: "lg" })}>
          Continue Shopping
        </Link>
      </StatusCard>
    );
  }

  if (order.paymentStatus === "failed" || order.paymentStatus === "cancelled") {
    return (
      <StatusCard
        tone="danger"
        icon={<CircleAlert className="size-8" aria-hidden />}
        title={order.paymentStatus === "cancelled" ? "Payment cancelled" : "Payment didn't go through"}
        body={`Order ${order.orderNumber} (${formatINR(order.totalPaise)}) is saved but not paid. Your items are held for a short time and your cart is untouched. If money left your account, it will be refunded by your bank.`}
      >
        {canRetryPayment(order) ? (
          <Button size="lg" onClick={onRetry} disabled={retrying} aria-busy={retrying}>
            {retrying ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            Retry payment
          </Button>
        ) : null}
        <Link href="/cart" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Back to cart
        </Link>
      </StatusCard>
    );
  }

  // pending / initiated: waiting for the provider to confirm.
  return (
    <StatusCard
      tone="warning"
      icon={timedOut ? <Hourglass className="size-8" aria-hidden /> : <Loader2 className="size-8 animate-spin" aria-hidden />}
      title={timedOut ? "Still waiting for confirmation" : "Confirming your payment…"}
      body={
        timedOut
          ? `We haven't received confirmation for ${order.orderNumber} yet. Please don't pay again. If you completed the payment, it will update here automatically. You can also check again.`
          : "This usually takes a few seconds. Please keep this page open."
      }
    >
      <Button
        size="lg"
        variant="outline"
        onClick={() => {
          startedAt.current = Date.now();
          setTick((n) => n + 1);
        }}
      >
        <RefreshCw aria-hidden />
        Check status
      </Button>
      {timedOut && canRetryPayment(order) ? (
        <Button size="lg" variant="ghost" onClick={onRetry} disabled={retrying}>
          I didn&apos;t pay. Retry payment
        </Button>
      ) : null}
    </StatusCard>
  );
}

function StatusCard({
  tone,
  icon,
  title,
  body,
  children,
}: {
  tone: "danger" | "warning";
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <CheckoutStepper current="review" />
      <div role="status" aria-live="polite" className="mx-auto flex max-w-md flex-col items-center px-2 py-8 text-center">
        <div
          className={`mb-4 flex size-16 items-center justify-center rounded-full ${
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-yellow-soft text-[#7a5b00]"
          }`}
        >
          {icon}
        </div>
        <h2 className="text-xl font-extrabold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">{children}</div>
      </div>
    </div>
  );
}
