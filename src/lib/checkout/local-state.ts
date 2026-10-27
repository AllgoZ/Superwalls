import { readStored, removeStored, writeStored } from "@/lib/browser-storage";

/**
 * Small pieces of checkout state that live on the customer's device.
 *
 * Guest tracking tokens are bearer secrets for that guest's own orders: they are kept in localStorage so the
 * customer can come back to their orders, are never put in URLs sent to the server, and become useless
 * once the order is attached to an account.
 */

const GUEST_ORDERS_KEY = "sw-guest-orders";
const PENDING_KEY = "sw-pending-checkout";
const MAX_GUEST_ORDERS = 25;

export interface GuestOrderRef {
  orderNumber: string;
  token: string;
  savedAt: string;
}

export function listGuestOrderRefs(): GuestOrderRef[] {
  const refs = readStored<unknown>(GUEST_ORDERS_KEY, []);
  if (!Array.isArray(refs)) return [];
  return refs.filter(
    (ref): ref is GuestOrderRef =>
      typeof ref === "object" &&
      ref !== null &&
      typeof (ref as GuestOrderRef).orderNumber === "string" &&
      typeof (ref as GuestOrderRef).token === "string",
  );
}

export function saveGuestOrderRef(orderNumber: string, token: string): void {
  const others = listGuestOrderRefs().filter((ref) => ref.orderNumber !== orderNumber);
  writeStored(GUEST_ORDERS_KEY, [{ orderNumber, token, savedAt: new Date().toISOString() }, ...others].slice(0, MAX_GUEST_ORDERS));
}

export function removeGuestOrderRefs(orderNumbers: string[]): void {
  const drop = new Set(orderNumbers);
  writeStored(GUEST_ORDERS_KEY, listGuestOrderRefs().filter((ref) => !drop.has(ref.orderNumber)));
}

export function getGuestToken(orderNumber: string): string | undefined {
  return listGuestOrderRefs().find((ref) => ref.orderNumber === orderNumber)?.token;
}

/**
 * The checkout currently awaiting a payment outcome. It lets the return page know which basket to clear
 * once payment is VERIFIED (never earlier), and keeps the idempotency key stable across retries and reloads.
 */
export interface PendingCheckout {
  mode: "cart" | "buy";
  /** Identifies the basket + contact + address this key belongs to. A change yields a fresh key. */
  fingerprint: string;
  idempotencyKey: string;
  orderNumber?: string;
  startedAt: string;
}

export function readPendingCheckout(): PendingCheckout | null {
  const value = readStored<PendingCheckout | null>(PENDING_KEY, null);
  return value && typeof value.idempotencyKey === "string" ? value : null;
}

export function writePendingCheckout(pending: PendingCheckout): void {
  writeStored(PENDING_KEY, pending);
}

export function clearPendingCheckout(): void {
  removeStored(PENDING_KEY);
}
