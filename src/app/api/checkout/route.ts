import { checkoutRequestSchema } from "@/lib/checkout/contract";
import { getAuthUser } from "@/lib/server/auth";
import { startCheckout } from "@/lib/server/checkout";
import { isBackendConfigured } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { clientIp, enforceRateLimit, handle, json, readJson, siteOrigin } from "@/lib/server/http";

/** Guest or registered checkout. Registered when a valid `Authorization: Bearer` token is sent. */
export function POST(request: Request) {
  return handle(async () => {
    if (!isBackendConfigured()) throw new ApiError("BACKEND_NOT_CONFIGURED", "The store backend is not configured yet.");
    await enforceRateLimit("checkout", clientIp(request), 20, 600);
    const body = await readJson(request, checkoutRequestSchema);
    const user = await getAuthUser(request);
    return json(await startCheckout(body, user, siteOrigin(request)), { status: 201 });
  });
}
