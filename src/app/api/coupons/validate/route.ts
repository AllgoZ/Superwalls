import { z } from "zod";
import { getAuthUser } from "@/lib/server/auth";
import { priceCart } from "@/lib/server/checkout";
import { queryOne } from "@/lib/server/db";
import { clientIp, enforceRateLimit, handle, json, readJson } from "@/lib/server/http";

const schema = z.object({
  code: z.string().trim().min(1).max(24),
  email: z.email().max(254).optional(),
  items: z.array(z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(100) })).min(1).max(50),
});

/**
 * Cart preview for a coupon. The discount is computed by the same database function checkout uses, from prices the
 * server read itself: the browser supplies a code and a cart, never an amount. Checkout validates again under a lock.
 */
export async function POST(request: Request) {
  return handle(async () => {
    // Tight limit: this endpoint must not be usable to guess valid coupon codes.
    await enforceRateLimit("coupon-validate", clientIp(request), 20, 60);
    const body = await readJson(request, schema);
    const user = await getAuthUser(request);

    const lines = await priceCart(body.items);
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
    const row = await queryOne<{ r: { code: string; discountPaise: number; description: string } }>(
      "select public.evaluate_promotion($1::text, $2::bigint, $3::uuid, $4::text) as r",
      [body.code, subtotal, user?.id ?? null, user?.email ?? body.email ?? null],
    );
    return json({ coupon: { code: row!.r.code, discountPaise: Number(row!.r.discountPaise), description: row!.r.description } });
  });
}
