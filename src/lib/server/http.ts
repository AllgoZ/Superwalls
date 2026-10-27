import "server-only";
import { createHash } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { ApiError } from "./errors";
import { query } from "./db";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { ...init, headers: { ...NO_STORE, ...init.headers } });
}

/** Wraps a route body: expected failures become `{ error: { code, message } }`, anything else a generic 500. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
    }
    // Next.js control-flow signals (e.g. "this route is dynamic") must not be swallowed as 500s.
    unstable_rethrow(error);
    console.error("[api] unhandled error:", error instanceof Error ? error.message : error);
    return json({ error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } }, { status: 500 });
  }
}

/** Reads and validates a JSON body with a hard size cap. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S, maxBytes = 64_000): Promise<z.infer<S>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError("VALIDATION", "Request is too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid request.");
  }
  return parsed.data;
}

/** Public origin used to build return URLs. Prefer the configured site URL over the (spoofable) Host header. */
export function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Counts a hit against `key`; throws 429 when over the limit. Backed by the database so it works across instances. */
export async function enforceRateLimit(scope: string, identity: string, max: number, windowSeconds: number): Promise<void> {
  const key = `${scope}:${createHash("sha256").update(identity).digest("hex").slice(0, 32)}`;
  const rows = await query<{ ok: boolean }>("select public.check_rate_limit($1, $2, $3) as ok", [key, max, windowSeconds]);
  if (!rows[0]?.ok) {
    throw new ApiError("RATE_LIMITED", "Too many attempts. Please wait a minute and try again.");
  }
}
