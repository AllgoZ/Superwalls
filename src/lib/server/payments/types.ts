import "server-only";
import type { PaymentAction } from "@/lib/checkout/contract";

/**
 * Provider-neutral payment gateway contract. A real adapter (Razorpay, Cashfree, Stripe...) implements
 * this interface and is registered in `./index.ts`; nothing else in the app knows which gateway is used.
 *
 * Rules every adapter must follow:
 *  - Amounts are integer paise and currency is ISO-4217; the adapter never rounds.
 *  - `handlePaymentWebhook` / `verifyPayment` MUST verify the provider's signature with the provider's
 *    official method before returning an event, and throw `InvalidSignatureError` otherwise.
 *  - The returned `eventId` must be stable per provider event so replays are recognised.
 *  - Secrets are read from server-only environment variables.
 */

export class InvalidSignatureError extends Error {
  constructor(message = "Invalid payment signature") {
    super(message);
    this.name = "InvalidSignatureError";
  }
}

export interface PaymentSessionRequest {
  /** Our payments.id; use as the provider's receipt / reference for idempotency. */
  paymentId: string;
  orderNumber: string;
  amountPaise: number;
  currency: string;
  customer: { name: string; email: string; phone: string };
  /** Absolute URL the customer returns to after paying (never trusted as proof of payment). */
  returnUrl: string;
}

export interface GatewayPaymentSession {
  /** The provider's id for this payment session / order. Stored as payments.provider_order_id. */
  providerOrderId: string;
  /** What the browser does next. */
  action: PaymentAction;
}

/** A provider notification whose authenticity has been verified. */
export interface VerifiedPaymentEvent {
  eventId: string;
  eventType: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amountPaise: number;
  currency: string;
  outcome: "paid" | "failed" | "cancelled";
  reason?: string;
  raw: Record<string, unknown>;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface RefundRequest {
  providerPaymentId: string;
  amountPaise: number;
  reason: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "pending" | "processed" | "failed";
}

export interface PaymentGateway {
  readonly id: string;
  readonly label: string;

  /** Creates the provider-side order / checkout session for an amount we computed. */
  createPaymentSession(request: PaymentSessionRequest): Promise<GatewayPaymentSession>;

  /** Rebuilds the customer-facing action for a session that already exists (customer came back / retried). */
  resumePaymentSession(providerOrderId: string, request: PaymentSessionRequest): Promise<PaymentAction>;

  /**
   * Verifies the signature a provider hands back through the browser (e.g. Razorpay's
   * `razorpay_signature`) and returns the authoritative payment record, or null when it is not a success.
   */
  verifyPayment(input: VerifyPaymentInput): Promise<VerifiedPaymentEvent | null>;

  /**
   * Verifies the webhook's signature over the RAW body, then parses it. Returns null for event types we
   * do not act on. Throws `InvalidSignatureError` when the signature does not match.
   */
  handlePaymentWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent | null>;

  refundPayment(request: RefundRequest): Promise<RefundResult>;
}
