import { getGuestToken } from "@/lib/checkout/local-state";
import type { Order } from "@/lib/types";
import { getSession } from "./auth";
import { listGuestOrders, trackGuestOrder } from "./checkout";
import { repositories } from "./repositories";

/** Signed-in customers read their own orders through RLS; guests use the tracking tokens held on this device. */
export async function getOrders(): Promise<Order[]> {
  const session = await getSession();
  return session.signedIn ? repositories.orders.list() : listGuestOrders();
}

/**
 * One order by its number. Registered customers go through RLS; otherwise the guest tracking token is used
 * (passed in explicitly, e.g. from a tracking link, or the one saved on this device).
 */
export async function getOrderByNumber(orderNumber: string, token?: string): Promise<Order | null> {
  const session = await getSession();
  if (session.signedIn) {
    const own = await repositories.orders.getByNumber(orderNumber);
    if (own) return own;
  }
  const guestToken = token ?? getGuestToken(orderNumber);
  return guestToken ? trackGuestOrder(orderNumber, guestToken) : null;
}
