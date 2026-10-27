import { retryPaymentRequestSchema } from "@/lib/checkout/contract";
import { getAuthUser } from "@/lib/server/auth";
import { retryPayment } from "@/lib/server/checkout";
import { clientIp, enforceRateLimit, handle, json, readJson, siteOrigin } from "@/lib/server/http";

/** Retry Payment for an unpaid order. Reuses the order; never creates a second one. */
export function POST(request: Request) {
  return handle(async () => {
    await enforceRateLimit("retry-ip", clientIp(request), 30, 600);
    const body = await readJson(request, retryPaymentRequestSchema);
    const user = await getAuthUser(request);
    return json(await retryPayment(body.orderNumber, user, body.token, siteOrigin(request)));
  });
}
