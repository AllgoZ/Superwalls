import { trackOrderRequestSchema } from "@/lib/checkout/contract";
import { trackGuestOrder } from "@/lib/server/checkout";
import { ApiError } from "@/lib/server/errors";
import { clientIp, enforceRateLimit, handle, json, readJson } from "@/lib/server/http";

/**
 * Guest order tracking. POST (not GET) so the secret token never lands in URLs, logs or Referer headers.
 * Rate limited per client IP; a wrong token and an unknown order look identical. There is deliberately no
 * per-order limit: tokens carry 256 bits (unguessable), and a per-order limit would let anyone lock the real
 * owner out of their own order just by spamming wrong codes.
 */
export function POST(request: Request) {
  return handle(async () => {
    await enforceRateLimit("track-ip", clientIp(request), 60, 60);
    const body = await readJson(request, trackOrderRequestSchema, 2_000);
    const order = await trackGuestOrder(body.orderNumber, body.token);
    if (!order) throw new ApiError("NOT_FOUND", "We couldn't find an order with that number and tracking code.");
    return json({ order });
  });
}
