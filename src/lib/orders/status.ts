import type { OrderStatus, PaymentMethodId, PaymentStatus } from "@/lib/types";

/**
 * Central place for order/payment status wording and ordering. Adapt these
 * maps to the real backend workflow; the UI reads everything from here.
 */

export type StatusTone = "neutral" | "info" | "progress" | "success" | "danger" | "warning";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; tone: StatusTone }
> = {
  placed: {
    label: "Order placed",
    description: "We've received your order.",
    tone: "info",
  },
  confirmed: {
    label: "Confirmed",
    description: "Your order has been confirmed.",
    tone: "info",
  },
  processing: {
    label: "Processing",
    description: "Your order is being prepared.",
    tone: "progress",
  },
  shipped: {
    label: "Shipped",
    description: "Your order is on its way to your city.",
    tone: "progress",
  },
  out_for_delivery: {
    label: "Out for delivery",
    description: "Your order will arrive today.",
    tone: "progress",
  },
  delivered: {
    label: "Delivered",
    description: "Your order has been delivered.",
    tone: "success",
  },
  cancelled: {
    label: "Cancelled",
    description: "This order was cancelled.",
    tone: "danger",
  },
};

/** The happy-path sequence shown in the timeline. `cancelled` is a terminal side branch. */
export const ORDER_TIMELINE: readonly OrderStatus[] = [
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export function isOrderActive(status: OrderStatus): boolean {
  return status !== "delivered" && status !== "cancelled";
}

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Payment pending", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Payment failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodId, string> = {
  cod: "Cash on Delivery",
  online: "Online payment",
};
