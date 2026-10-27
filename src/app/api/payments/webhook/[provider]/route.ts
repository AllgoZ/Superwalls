import { ApiError } from "@/lib/server/errors";
import { handle, json } from "@/lib/server/http";
import { applyPaymentEvent, getGatewayById, InvalidSignatureError } from "@/lib/server/payments";

const MAX_BODY_BYTES = 256_000;

/**
 * Payment provider webhook. The signature is verified over the RAW body before anything is parsed or trusted.
 * Responds 2xx for events that were handled or are safe to ignore, and 5xx on our own failures so the
 * provider retries. Replays are harmless: processing is idempotent per provider event id.
 */
export function POST(request: Request, ctx: RouteContext<"/api/payments/webhook/[provider]">) {
  return handle(async () => {
    const { provider } = await ctx.params;
    const gateway = getGatewayById(provider);
    if (!gateway) throw new ApiError("NOT_FOUND", "Unknown payment provider.");

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) throw new ApiError("VALIDATION", "Payload too large.");

    let event;
    try {
      event = await gateway.handlePaymentWebhook(raw, request.headers);
    } catch (error) {
      if (error instanceof InvalidSignatureError) throw new ApiError("INVALID_SIGNATURE", "Invalid signature.");
      throw error;
    }
    if (!event) return json({ received: true, result: "ignored" });

    const result = await applyPaymentEvent(gateway.id, event);
    return json({ received: true, result: result.result });
  });
}
