import { z } from "zod";
import { query } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { handle, json, readJson } from "@/lib/server/http";
import { applyPaymentEvent, InvalidSignatureError } from "@/lib/server/payments";
import { buildSandboxWebhook, isSandboxEnabled, sandboxGateway, SANDBOX_ID } from "@/lib/server/payments/sandbox";

const schema = z.object({
  providerOrderId: z.string().min(1).max(200),
  outcome: z.enum(["paid", "failed", "cancelled"]),
});

/**
 * DEV ONLY (404 unless the sandbox gateway is enabled outside production). Plays the role of the gateway:
 * it signs a webhook exactly as a provider would and pushes it through the SAME verification and
 * finalisation path as the real webhook route. The browser never gets to say "this order is paid".
 */
export function POST(request: Request) {
  return handle(async () => {
    if (!isSandboxEnabled()) throw new ApiError("NOT_FOUND", "Not found.");
    const body = await readJson(request, schema, 2_000);
    const rows = await query<{ amount: string; currency: string }>(
      "select amount, currency from payments where provider = $1 and provider_order_id = $2",
      [SANDBOX_ID, body.providerOrderId],
    );
    if (!rows[0]) throw new ApiError("NOT_FOUND", "Payment session not found.");

    const { raw, signature } = buildSandboxWebhook({
      type: body.outcome === "paid" ? "payment.captured" : "payment.failed",
      providerOrderId: body.providerOrderId,
      providerPaymentId: body.outcome === "paid" ? `sbx_pay_${body.providerOrderId.slice(-12)}` : null,
      amount: Number(rows[0].amount),
      currency: rows[0].currency,
      outcome: body.outcome,
      reason: body.outcome === "paid" ? undefined : `sandbox_${body.outcome}`,
    });

    const headers = new Headers({ "x-sandbox-signature": signature });
    try {
      const event = await sandboxGateway.handlePaymentWebhook(raw, headers);
      if (!event) return json({ result: "ignored" });
      const result = await applyPaymentEvent(SANDBOX_ID, event);
      return json({ result: result.result });
    } catch (error) {
      if (error instanceof InvalidSignatureError) throw new ApiError("INVALID_SIGNATURE", "Invalid signature.");
      throw error;
    }
  });
}
