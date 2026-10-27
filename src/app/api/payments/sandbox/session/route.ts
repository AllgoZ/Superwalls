import { connection } from "next/server";
import { query } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { handle, json } from "@/lib/server/http";
import { isSandboxEnabled, SANDBOX_ID } from "@/lib/server/payments/sandbox";

/** DEV ONLY (404 unless the sandbox gateway is enabled outside production): details for the test payment page. */
export function GET(request: Request) {
  return handle(async () => {
    await connection(); // request-time only
    if (!isSandboxEnabled()) throw new ApiError("NOT_FOUND", "Not found.");
    const providerOrderId = new URL(request.url).searchParams.get("o") ?? "";
    const rows = await query<{ amount: string; currency: string; status: string; order_number: string }>(
      `select p.amount, p.currency, p.status, o.order_number
         from payments p join orders o on o.id = p.order_id
        where p.provider = $1 and p.provider_order_id = $2`,
      [SANDBOX_ID, providerOrderId],
    );
    if (!rows[0]) throw new ApiError("NOT_FOUND", "Payment session not found.");
    return json({
      amountPaise: Number(rows[0].amount),
      currency: rows[0].currency,
      status: rows[0].status,
      orderNumber: rows[0].order_number,
    });
  });
}
