import { claimOrdersRequestSchema } from "@/lib/checkout/contract";
import { requireAuthUser } from "@/lib/server/auth";
import { claimGuestOrders } from "@/lib/server/checkout";
import { clientIp, enforceRateLimit, handle, json, readJson } from "@/lib/server/http";

/** Adds earlier guest orders to the signed-in account, after ownership is proven (see claimGuestOrders). */
export function POST(request: Request) {
  return handle(async () => {
    await enforceRateLimit("claim-ip", clientIp(request), 30, 600);
    const user = await requireAuthUser(request);
    const body = await readJson(request, claimOrdersRequestSchema, 8_000);
    return json({ claimed: await claimGuestOrders(user, body.tokens) });
  });
}
