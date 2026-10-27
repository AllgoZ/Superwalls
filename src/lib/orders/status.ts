import type { OrderStatus, PaymentStatus } from "@/lib/types";

/**
 * Central place for order/payment status wording and ordering. Fulfilment status and payment
 * status are independent: an order is only ever "placed" once its payment is verified as paid.
 */

export type StatusTone = "neutral" | "info" | "progress" | "success" | "danger" | "warning";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; tone: StatusTone }
> = {
  pending_payment: {
    label: "Awaiting payment",
    description: "We'll place your order as soon as the payment is confirmed.",
    tone: "warning",
  },
  placed: {
    label: "Order placed",
    description: "Payment confirmed. We've received your order.",
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
  initiated: { label: "Payment in progress", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  failed: { label: "Payment failed", tone: "danger" },
  cancelled: { label: "Payment cancelled", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
  partially_refunded: { label: "Partially refunded", tone: "neutral" },
};

/** Payment statuses from which the customer can try to pay again. */
export function canRetryPayment(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
  return (
    order.status === "pending_payment" &&
    (order.paymentStatus === "failed" ||
      order.paymentStatus === "cancelled" ||
      order.paymentStatus === "pending" ||
      order.paymentStatus === "initiated")
  );
}

export const PAYMENT_METHOD_LABEL = "Online payment";
