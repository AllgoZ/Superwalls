import { verifyPaymentRequestSchema } from "@/lib/checkout/contract";
import { ApiError } from "@/lib/server/errors";
import { clientIp, enforceRateLimit, handle, json, readJson } from "@/lib/server/http";
import { applyPaymentEvent, getGatewayById, InvalidSignatureError } from "@/lib/server/payments";

/**
 * Server-side verification of the proof a gateway hands back through the browser (e.g. a payment signature).
 * The redirect/callback itself proves nothing: this endpoint re-checks the provider's signature and only
 * then applies the same idempotent finalisation as the webhook.
 */
export function POST(request: Request) {
  return handle(async () => {
    await enforceRateLimit("verify-ip", clientIp(request), 30, 60);
    const body = await readJson(request, verifyPaymentRequestSchema, 4_000);
    const gateway = getGatewayById(body.provider);
    if (!gateway) throw new ApiError("NOT_FOUND", "Unknown payment provider.");

    let event;
    try {
      event = await gateway.verifyPayment(body);
    } catch (error) {
      if (error instanceof InvalidSignatureError) throw new ApiError("INVALID_SIGNATURE", "Payment could not be verified.");
      throw error;
    }
    if (!event) throw new ApiError("NOT_FOUND", "We couldn't find that payment.");
    const result = await applyPaymentEvent(gateway.id, event);
    return json({ result: result.result, paymentStatus: result.paymentStatus });
  });
}
