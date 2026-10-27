import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { query } from "@/lib/server/db";
import { ApiError } from "@/lib/server/errors";
import { handle, json } from "@/lib/server/http";

/**
 * Releases expired stock holds. pg_cron already does this every minute inside the database
 * (migration 0005); this route is the fallback for hosts that schedule HTTP crons instead.
 * Requires `Authorization: Bearer $CRON_SECRET`; disabled (404) when CRON_SECRET is unset.
 */
export function GET(request: Request) {
  return handle(async () => {
    await connection(); // always runs at request time, never prerendered
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new ApiError("NOT_FOUND", "Not found.");
    const provided = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new ApiError("UNAUTHENTICATED", "Unauthorized.");
    }
    const rows = await query<{ n: number }>("select public.expire_reservations() as n");
    return json({ released: rows[0]?.n ?? 0 });
  });
}
