import "server-only";
import { query } from "../db";
import { isSandboxEnabled, sandboxGateway } from "./sandbox";
import type { PaymentGateway, VerifiedPaymentEvent } from "./types";

export { InvalidSignatureError } from "./types";
export type { PaymentGateway, VerifiedPaymentEvent } from "./types";

/**
 * Gateway registry. `PAYMENT_PROVIDER` selects the adapter.
 *
 * No real provider is wired up yet, so in production this returns null and checkout reports
 * "payment is not configured" instead of pretending. To add a provider: implement `PaymentGateway`
 * (see ./types.ts), import it here, and map its id below.
 */
const ADAPTERS: Record<string, () => PaymentGateway | null> = {
  sandbox: () => (isSandboxEnabled() ? sandboxGateway : null),
  // razorpay: () => (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? razorpayGateway : null),
};

export function getPaymentGateway(): PaymentGateway | null {
  const id = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  if (!id) return null;
  return ADAPTERS[id]?.() ?? null;
}

export function getGatewayById(id: string): PaymentGateway | null {
  const active = getPaymentGateway();
  return active && active.id === id ? active : null;
}

export interface FinalizeResult {
  result: string;
  orderId?: string;
  orderNumber?: string;
  orderStatus?: string;
  paymentStatus?: string;
}

/**
 * Applies a VERIFIED provider event. All state changes happen inside one database function that is
 * idempotent per (provider, event id), checks the amount against our own record, and locks the order,
 * payment and stock rows. Calling it twice with the same event is a safe no-op.
 */
export async function applyPaymentEvent(provider: string, event: VerifiedPaymentEvent): Promise<FinalizeResult> {
  const rows = await query<{ r: FinalizeResult }>(
    "select public.finalize_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as r",
    [
      provider,
      event.eventId,
      event.eventType,
      event.providerOrderId,
      event.providerPaymentId,
      event.amountPaise,
      event.currency,
      event.outcome,
      event.reason ?? null,
      JSON.stringify(event.raw),
    ],
  );
  return rows[0]?.r ?? { result: "no_result" };
}
