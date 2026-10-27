import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { query } from "../db";
import {
  InvalidSignatureError,
  type GatewayPaymentSession,
  type PaymentGateway,
  type PaymentSessionRequest,
  type VerifiedPaymentEvent,
} from "./types";

/**
 * DEVELOPMENT-ONLY test gateway. It exists so the webhook, signature, idempotency and inventory paths
 * can be exercised end to end before a real provider is chosen. It moves no money.
 *
 * It is refused outright in production builds (see `isSandboxEnabled`), and it is not a stand-in for a
 * real gateway: nothing about it makes a production payment succeed.
 */
export const SANDBOX_ID = "sandbox";

export function isSandboxEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PAYMENT_PROVIDER === SANDBOX_ID &&
    Boolean(process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET)
  );
}

function secret(): string {
  const value = process.env.PAYMENT_SANDBOX_WEBHOOK_SECRET;
  if (!value) throw new Error("PAYMENT_SANDBOX_WEBHOOK_SECRET is not set");
  return value;
}

export function sandboxSign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function signatureMatches(payload: string, provided: string): boolean {
  const expected = Buffer.from(sandboxSign(payload), "hex");
  let actual: Buffer;
  try {
    actual = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function checkoutUrl(providerOrderId: string): string {
  return `/pay/sandbox?o=${encodeURIComponent(providerOrderId)}`;
}

interface SandboxWebhookBody {
  id: string;
  type: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  outcome: "paid" | "failed" | "cancelled";
  reason?: string;
}

/** Builds the signed body a real provider would POST to our webhook. Used by the sandbox "pay" page. */
export function buildSandboxWebhook(body: Omit<SandboxWebhookBody, "id"> & { id?: string }) {
  const raw = JSON.stringify({ ...body, id: body.id ?? `evt_${randomUUID()}` });
  return { raw, signature: sandboxSign(raw) };
}

export const sandboxGateway: PaymentGateway = {
  id: SANDBOX_ID,
  label: "Test payment (sandbox)",

  async createPaymentSession(_request: PaymentSessionRequest): Promise<GatewayPaymentSession> {
    void _request;
    const providerOrderId = `sbx_order_${randomUUID()}`;
    return { providerOrderId, action: { kind: "redirect", url: checkoutUrl(providerOrderId) } };
  },

  async resumePaymentSession(providerOrderId) {
    return { kind: "redirect", url: checkoutUrl(providerOrderId) };
  },

  async verifyPayment({ providerOrderId, providerPaymentId, signature }): Promise<VerifiedPaymentEvent | null> {
    if (!signatureMatches(`${providerOrderId}|${providerPaymentId}`, signature)) throw new InvalidSignatureError();
    // A real adapter would fetch the payment from the provider's API here to learn the amount.
    const rows = await query<{ amount: string; currency: string }>(
      "select amount, currency from payments where provider = $1 and provider_order_id = $2",
      [SANDBOX_ID, providerOrderId],
    );
    if (!rows[0]) return null;
    return {
      eventId: `verify:${providerPaymentId}`,
      eventType: "payment.verified",
      providerOrderId,
      providerPaymentId,
      amountPaise: Number(rows[0].amount),
      currency: rows[0].currency,
      outcome: "paid",
      raw: { providerOrderId, providerPaymentId },
    };
  },

  async handlePaymentWebhook(rawBody, headers): Promise<VerifiedPaymentEvent | null> {
    const signature = headers.get("x-sandbox-signature");
    if (!signature || !signatureMatches(rawBody, signature)) throw new InvalidSignatureError();

    const body = JSON.parse(rawBody) as SandboxWebhookBody;
    if (!["paid", "failed", "cancelled"].includes(body.outcome)) return null;
    return {
      eventId: body.id,
      eventType: body.type,
      providerOrderId: body.providerOrderId,
      providerPaymentId: body.providerPaymentId,
      amountPaise: body.amount,
      currency: body.currency,
      outcome: body.outcome,
      reason: body.reason,
      raw: body as unknown as Record<string, unknown>,
    };
  },

  async refundPayment() {
    throw new Error("The sandbox gateway does not support refunds.");
  },
};
