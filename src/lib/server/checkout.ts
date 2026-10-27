import "server-only";
import { timingSafeEqual } from "node:crypto";
import { calculateTotals } from "@/lib/commerce/pricing";
import { formatINR } from "@/lib/formatters";
import type { CheckoutRequest, CheckoutResponse, OrderPayload, PaymentSessionInfo } from "@/lib/checkout/contract";
import type { AuthUser } from "./auth";
import { query, queryOne } from "./db";
import { getDeliverySettings, isServiceable, toCommerceConfig } from "./commerce-config";
import { ApiError } from "./errors";
import { generateGuestToken, hashGuestToken } from "./guest-token";
import { getPaymentGateway } from "./payments";
import type { PaymentGateway } from "./payments/types";

/** How long stock is held for an unpaid order. Configurable; a retry refreshes the hold. */
function reservationMinutes(): number {
  const value = Number(process.env.INVENTORY_RESERVATION_MINUTES ?? 30);
  return Number.isFinite(value) && value >= 5 && value <= 24 * 60 ? Math.floor(value) : 30;
}

const MAX_QUANTITY_PER_ITEM = 10;

function requireGateway(): PaymentGateway {
  const gateway = getPaymentGateway();
  if (!gateway) {
    // Fail BEFORE creating an order or holding stock, so an unconfigured store never accumulates pending orders.
    throw new ApiError(
      "PAYMENT_NOT_CONFIGURED",
      "Online payment isn't set up yet, so we can't take orders right now. Please check back soon.",
    );
  }
  return gateway;
}

/** Starts (or resumes) the single live payment attempt for an order and returns what the browser should do. */
async function beginPayment(orderId: string, gateway: PaymentGateway, origin: string): Promise<PaymentSessionInfo> {
  const [attempt] = await query<{
    r: { paymentId: string; amount: number; currency: string; providerOrderId: string | null; orderNumber: string };
  }>("select public.begin_payment_attempt($1::uuid, $2::text, $3::int) as r", [orderId, gateway.id, reservationMinutes()]);
  const payment = attempt.r;

  const customer = await queryOne<{ customer_name: string; customer_email: string; customer_phone: string }>(
    "select customer_name, customer_email, customer_phone from orders where id = $1",
    [orderId],
  );
  if (!customer) throw new ApiError("NOT_FOUND", "We couldn't find that order.");

  const request = {
    paymentId: payment.paymentId,
    orderNumber: payment.orderNumber,
    amountPaise: Number(payment.amount),
    currency: payment.currency,
    customer: { name: customer.customer_name, email: customer.customer_email, phone: customer.customer_phone },
    returnUrl: `${origin}/checkout/return?order=${encodeURIComponent(payment.orderNumber)}`,
  };

  if (payment.providerOrderId) {
    return { provider: gateway.id, action: await gateway.resumePaymentSession(payment.providerOrderId, request) };
  }

  try {
    const session = await gateway.createPaymentSession(request);
    await query("select public.record_payment_session($1::uuid, $2::text)", [payment.paymentId, session.providerOrderId]);
    return { provider: gateway.id, action: session.action };
  } catch (error) {
    await query("select public.fail_payment_attempt($1::uuid, $2::text)", [
      payment.paymentId,
      error instanceof Error ? error.message : "gateway_error",
    ]).catch(() => undefined);
    console.error("[payments] createPaymentSession failed:", error instanceof Error ? error.message : error);
    throw new ApiError("PAYMENT_PROVIDER_ERROR", "We couldn't start the payment. Nothing was charged. Please try again.");
  }
}

/** Merges duplicate lines and prices every line from the DATABASE. Unknown or inactive products are unavailable. */
export async function priceCart(items: { productId: string; quantity: number }[]) {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  const ids = [...quantities.keys()];
  const products = await query<{ id: string; price_paise: string; is_active: boolean }>(
    "select id, price_paise, is_active from products where id = any($1::text[])",
    [ids],
  );
  const priceById = new Map(products.filter((p) => p.is_active).map((p) => [p.id, Number(p.price_paise)]));

  const lines = [];
  for (const [productId, quantity] of quantities) {
    const price = priceById.get(productId);
    if (price === undefined) {
      throw new ApiError("OUT_OF_STOCK", "Some items are no longer available. Please review your cart.", { productId });
    }
    if (quantity > MAX_QUANTITY_PER_ITEM) throw new ApiError("VALIDATION", "Quantity is above the per-item limit.");
    lines.push({ productId, quantity, lineTotalPaise: price * quantity });
  }
  return lines;
}

/**
 * Guest or registered checkout: validates, prices from the DATABASE, creates a pending-payment order with
 * stock reserved atomically, then opens a payment session with the gateway.
 * The request carries no prices, totals or ownership; all three are decided here.
 */
export async function startCheckout(request: CheckoutRequest, user: AuthUser | null, origin: string): Promise<CheckoutResponse> {
  const gateway = requireGateway();

  const email = user ? user.email : request.email;
  if (!email) throw new ApiError("VALIDATION", "An email address is required.");

  // The browser's idea of a price is never used: every line is priced from the catalog, and the delivery rules
  // (fee, free-delivery threshold, minimum order, serviceable areas) come from the settings row in the database.
  const lines = await priceCart(request.items);
  const settings = await getDeliverySettings();
  const totals = calculateTotals(lines, toCommerceConfig(settings));
  if (totals.subtotalPaise < settings.minOrderPaise) {
    throw new ApiError("MIN_ORDER", `The minimum order is ${formatINR(settings.minOrderPaise)}. Add a little more to your cart.`);
  }
  if (!isServiceable(settings, request.address)) {
    throw new ApiError("NOT_SERVICEABLE", "Sorry, we can't deliver to that address yet. Please try another PIN code or city.");
  }

  const guestToken = user ? null : generateGuestToken();
  const [created] = await query<{ r: { orderId: string; orderNumber: string; replayed: boolean } }>(
    `select public.create_checkout_order(
       $1::text, $2::uuid, $3::text, $4::text, $5::text, $6::jsonb, $7::jsonb,
       $8::bigint, $9::bigint, $10::bigint, $11::text, $12::int, $13::int, $14::text) as r`,
    [
      request.idempotencyKey,
      user?.id ?? null,
      request.address.fullName,
      email,
      request.address.mobile,
      JSON.stringify(request.address),
      JSON.stringify(lines.map(({ productId, quantity }) => ({ productId, quantity }))),
      totals.subtotalPaise,
      totals.discountPaise,
      totals.deliveryPaise,
      guestToken ? hashGuestToken(guestToken) : null,
      reservationMinutes(),
      MAX_QUANTITY_PER_ITEM,
      // Validated and priced inside the database function, under a lock, so usage limits cannot be raced past.
      request.couponCode?.trim() || null,
    ],
  );
  const order = created.r;

  const payment = await beginPayment(order.orderId, gateway, origin);

  const [row] = await query<{ total_paise: string }>("select total_paise from orders where id = $1", [order.orderId]);
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    totalPaise: Number(row.total_paise),
    // A replay never re-issues a token: the hash is all we kept, and the first response already delivered it.
    guestToken: !order.replayed && guestToken ? guestToken : undefined,
    payment,
  };
}

function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Proves the caller may act on an order: the signed-in owner, or the holder of the guest token.
 * Anyone else gets NOT_FOUND, so order numbers cannot be probed for existence.
 */
export async function authorizeOrderAccess(orderNumber: string, user: AuthUser | null, token: string | undefined): Promise<string> {
  const order = await queryOne<{ id: string; customer_type: string; user_id: string | null; guest_tracking_token_hash: string | null }>(
    "select id, customer_type, user_id, guest_tracking_token_hash from orders where order_number = $1",
    [orderNumber],
  );
  const notFound = new ApiError("NOT_FOUND", "We couldn't find that order.");
  if (!order) throw notFound;
  if (order.customer_type === "registered") {
    if (!user || user.id !== order.user_id) throw notFound;
  } else {
    if (!token || !order.guest_tracking_token_hash || !hashesEqual(hashGuestToken(token), order.guest_tracking_token_hash)) {
      throw notFound;
    }
  }
  return order.id;
}

/** Retry Payment: reuses the same order, never creates another. Safe to call repeatedly. */
export async function retryPayment(orderNumber: string, user: AuthUser | null, token: string | undefined, origin: string): Promise<CheckoutResponse> {
  const gateway = requireGateway();
  const orderId = await authorizeOrderAccess(orderNumber, user, token);
  const payment = await beginPayment(orderId, gateway, origin);
  const [row] = await query<{ total_paise: string }>("select total_paise from orders where id = $1", [orderId]);
  return { orderId, orderNumber, totalPaise: Number(row.total_paise), payment };
}

/** Guest order lookup: the database function only matches when order number AND token hash both match. */
export async function trackGuestOrder(orderNumber: string, token: string): Promise<OrderPayload | null> {
  const rows = await query<{ r: OrderPayload | null }>("select public.get_guest_order($1::text, $2::text) as r", [
    orderNumber,
    hashGuestToken(token),
  ]);
  return rows[0]?.r ?? null;
}

/**
 * Links guest orders to the signed-in account. Ownership must be proven by a secret tracking token the
 * caller holds, or by an email address that Supabase has verified for this very account.
 */
export async function claimGuestOrders(user: AuthUser, tokens: string[]): Promise<number> {
  const rows = await query<{ n: number }>("select public.claim_guest_orders($1::uuid, $2::text, $3::text[]) as n", [
    user.id,
    user.verifiedEmail,
    tokens.map(hashGuestToken),
  ]);
  return rows[0]?.n ?? 0;
}
