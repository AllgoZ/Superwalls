import type { CheckoutRequest, CheckoutResponse, OrderPayload } from "@/lib/checkout/contract";
import { getGuestToken, removeGuestOrderRefs, listGuestOrderRefs, saveGuestOrderRef } from "@/lib/checkout/local-state";
import type { Order } from "@/lib/types";
import { apiPost } from "./api";
import { emitDataChange } from "./events";
import { orderFromPayload } from "./mappers";
import { ServiceError } from "./errors";

/**
 * Browser side of checkout. None of these calls carries a price, total, payment status or owner: the server
 * decides all of those. Guests are identified by a secret tracking token that only their device holds.
 */

/** Creates the order, reserves stock and opens a payment session. Registered when signed in, otherwise guest. */
export async function startCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
  const response = await apiPost<CheckoutResponse>("/api/checkout", request, { auth: true });
  if (response.guestToken) saveGuestOrderRef(response.orderNumber, response.guestToken);
  return response;
}

export interface CouponPreview {
  code: string;
  discountPaise: number;
  description: string;
}

/**
 * Asks the server what a coupon is worth for this cart. The server prices the cart itself, so the browser only sends
 * a code and product ids; the amount that is actually charged is decided again, under a lock, at checkout.
 */
export async function previewCoupon(code: string, items: { productId: string; quantity: number }[], email?: string): Promise<CouponPreview> {
  const { coupon } = await apiPost<{ coupon: CouponPreview }>("/api/coupons/validate", { code, items, email: email || undefined }, { auth: true });
  return coupon;
}

/** Retry Payment: same order, new (or resumed) payment attempt. */
export async function retryPayment(orderNumber: string): Promise<CheckoutResponse> {
  return apiPost<CheckoutResponse>(
    "/api/orders/retry-payment",
    { orderNumber, token: getGuestToken(orderNumber) },
    { auth: true },
  );
}

/** Looks up a guest order with its tracking token. Returns null when the number/token pair is unknown. */
export async function trackGuestOrder(orderNumber: string, token: string): Promise<Order | null> {
  try {
    const { order } = await apiPost<{ order: OrderPayload }>("/api/orders/track", { orderNumber, token });
    return orderFromPayload(order);
  } catch (error) {
    if (error instanceof ServiceError && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

/** Guest orders remembered on this device, fetched fresh via their tokens (unknown/claimed ones are dropped). */
export async function listGuestOrders(): Promise<Order[]> {
  const refs = listGuestOrderRefs().slice(0, 10);
  const results = await Promise.all(
    refs.map(async (ref) => {
      try {
        return { ref, order: await trackGuestOrder(ref.orderNumber, ref.token) };
      } catch {
        return { ref, order: undefined };
      }
    }),
  );
  // `null` means the server says this token no longer matches (e.g. the order was added to an account).
  const stale = results.filter((result) => result.order === null).map((result) => result.ref.orderNumber);
  if (stale.length > 0) removeGuestOrderRefs(stale);
  return results
    .flatMap((result) => (result.order ? [result.order] : []))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

let claimedFor: string | null = null;

/**
 * After sign-in: ask the server to attach earlier guest orders to this account. The server only does so for
 * orders whose secret token this device holds, or whose email Supabase has verified belongs to this account.
 */
export async function claimGuestOrders(userId: string): Promise<number> {
  if (claimedFor === userId) return 0;
  claimedFor = userId;
  const refs = listGuestOrderRefs();
  try {
    const { claimed } = await apiPost<{ claimed: number }>(
      "/api/orders/claim",
      { tokens: refs.map((ref) => ref.token) },
      { auth: true },
    );
    if (claimed > 0) {
      removeGuestOrderRefs(refs.map((ref) => ref.orderNumber));
      emitDataChange();
    }
    return claimed;
  } catch {
    claimedFor = null; // allow another attempt later
    return 0;
  }
}
