import type { ApiErrorBody } from "@/lib/checkout/contract";
import { ServiceError, type ServiceErrorCode } from "./errors";
import { repositories } from "./repositories";

const KNOWN_CODES = new Set<string>([
  "VALIDATION",
  "EMPTY_CART",
  "OUT_OF_STOCK",
  "PRICE_CHANGED",
  "PAYMENT_NOT_CONFIGURED",
  "PAYMENT_PROVIDER_ERROR",
  "ALREADY_PAID",
  "ORDER_NOT_PAYABLE",
  "RATE_LIMITED",
  "MIN_ORDER",
  "NOT_SERVICEABLE",
  "NOT_FOUND",
  "UNAUTHENTICATED",
  "BACKEND_NOT_CONFIGURED",
]);

/**
 * POSTs JSON to our own route handlers. When `auth` is set and the customer is signed in, their access token
 * goes in the Authorization header; the server verifies it with Supabase, so it cannot be forged.
 */
export async function apiPost<T>(path: string, body: unknown, options: { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth) {
    const token = await repositories.auth.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  } catch {
    throw new ServiceError("NETWORK", "We couldn't reach the server. Check your connection and try again.");
  }

  const data = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok) {
    const code = data?.error?.code;
    throw new ServiceError(
      (code && KNOWN_CODES.has(code) ? code : "UNKNOWN") as ServiceErrorCode,
      data?.error?.message ?? "Something went wrong. Please try again.",
    );
  }
  return data as T;
}
