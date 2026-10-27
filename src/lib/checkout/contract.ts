import { z } from "zod";
import { addressSchema } from "@/lib/validation/schemas";

/**
 * Request / response contract shared by the checkout UI and the route handlers.
 * Deliberately has no prices, totals, payment status or ownership: the server decides all of them.
 */

export const ORDER_NUMBER_REGEX = /^SW-\d{6}-\d{3,}$/;

export const checkoutRequestSchema = z.object({
  /** Client-generated; the same key always resolves to the same order. */
  idempotencyKey: z.string().min(16).max(128),
  email: z.email("Enter a valid email address").max(254),
  address: addressSchema,
  /** Optional coupon code. The server re-validates it and computes the discount; the browser never sends an amount. */
  couponCode: z.string().trim().max(24).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(100),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .max(50),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const retryPaymentRequestSchema = z.object({
  orderNumber: z.string().regex(ORDER_NUMBER_REGEX),
  /** Guest access token. Omit when signed in (the bearer token identifies the owner). */
  token: z.string().min(20).max(100).optional(),
});
export type RetryPaymentRequest = z.infer<typeof retryPaymentRequestSchema>;

export const trackOrderRequestSchema = z.object({
  orderNumber: z.string().regex(ORDER_NUMBER_REGEX),
  token: z.string().min(20).max(100),
});
export type TrackOrderRequest = z.infer<typeof trackOrderRequestSchema>;

export const claimOrdersRequestSchema = z.object({
  tokens: z.array(z.string().min(20).max(100)).max(25),
});

export const verifyPaymentRequestSchema = z.object({
  provider: z.string().min(1).max(40),
  providerOrderId: z.string().min(1).max(200),
  providerPaymentId: z.string().min(1).max(200),
  signature: z.string().min(1).max(500),
});

/** What the browser must do next to take the customer's payment. */
export type PaymentAction = { kind: "redirect"; url: string };

export interface PaymentSessionInfo {
  provider: string;
  action: PaymentAction;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  /** Returned exactly once, on first creation of a guest order. Only its hash is stored. */
  guestToken?: string;
  payment: PaymentSessionInfo;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

/** Shape returned by `order_json()` in the database; the single order payload for guests. */
export interface OrderPayload {
  id: string;
  orderNumber: string;
  customerType: "registered" | "guest";
  createdAt: string;
  placedAt: string | null;
  orderStatus: string;
  paymentStatus: string;
  subtotalPaise: number;
  discountPaise: number;
  deliveryPaise: number;
  totalPaise: number;
  customerName: string;
  address: import("@/lib/types").AddressFields;
  items: {
    productId: string;
    name: string;
    imageSrc: string | null;
    unitPricePaise: number;
    quantity: number;
    lineTotalPaise: number;
  }[];
  events: { status: string; at: string }[];
}
