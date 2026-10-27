import "server-only";

export type ApiErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "EMPTY_CART"
  | "PAYMENT_NOT_CONFIGURED"
  | "PAYMENT_PROVIDER_ERROR"
  | "ALREADY_PAID"
  | "ORDER_NOT_PAYABLE"
  | "CONFLICT"
  | "MIN_ORDER"
  | "NOT_SERVICEABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_SIGNATURE"
  | "BACKEND_NOT_CONFIGURED"
  | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  OUT_OF_STOCK: 409,
  PRICE_CHANGED: 409,
  EMPTY_CART: 400,
  PAYMENT_NOT_CONFIGURED: 503,
  PAYMENT_PROVIDER_ERROR: 502,
  ALREADY_PAID: 409,
  ORDER_NOT_PAYABLE: 409,
  CONFLICT: 409,
  MIN_ORDER: 422,
  NOT_SERVICEABLE: 422,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_SIGNATURE: 401,
  BACKEND_NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

/** An expected failure with a stable `code` the client can branch on and a customer-safe message. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

const SQL_ERRORS: { pattern: RegExp; build: (match: RegExpMatchArray) => ApiError }[] = [
  {
    pattern: /OUT_OF_STOCK:?(.*)/,
    build: (m) =>
      new ApiError("OUT_OF_STOCK", "Some items are no longer available in the requested quantity. Please review your cart.", {
        productId: m[1] || undefined,
      }),
  },
  { pattern: /PRICE_CHANGED/, build: () => new ApiError("PRICE_CHANGED", "A price changed while you were checking out. Please review your order.") },
  { pattern: /EMPTY_CART/, build: () => new ApiError("EMPTY_CART", "Your cart is empty.") },
  { pattern: /VALIDATION:?(.*)/, build: () => new ApiError("VALIDATION", "Please check your order details.") },
  { pattern: /IDEMPOTENCY_CONFLICT/, build: () => new ApiError("IDEMPOTENCY_CONFLICT", "This checkout request was already used. Please start again.") },
  { pattern: /ALREADY_PAID/, build: () => new ApiError("ALREADY_PAID", "This order is already paid.") },
  { pattern: /ORDER_NOT_PAYABLE/, build: () => new ApiError("ORDER_NOT_PAYABLE", "This order can no longer be paid. Please place a new order.") },
  { pattern: /(?<![A-Z_])NOT_FOUND/, build: () => new ApiError("NOT_FOUND", "We couldn't find that.") },

  // Admin CMS (supabase/migrations/0006+). Messages are shown to staff, so they can be specific.
  { pattern: /FORBIDDEN/, build: () => new ApiError("FORBIDDEN", "You don't have permission to do that.") },
  { pattern: /LAST_SUPER_ADMIN/, build: () => new ApiError("CONFLICT", "At least one active super admin must remain.") },
  { pattern: /ALREADY_MEMBER/, build: () => new ApiError("CONFLICT", "That email already has admin access or a pending invitation.") },
  { pattern: /SELF_CHANGE/, build: () => new ApiError("CONFLICT", "You can't change your own access. Ask another super admin.") },
  { pattern: /MEMBER_REVOKED/, build: () => new ApiError("CONFLICT", "That access was revoked. Invite the person again instead.") },
  { pattern: /NOT_ACCEPTED/, build: () => new ApiError("CONFLICT", "That person hasn't signed in yet, so this isn't possible.") },
  { pattern: /DUPLICATE:?(.*)/, build: (m) => new ApiError("CONFLICT", `That ${m[1]?.trim() || "value"} is already in use.`) },
  { pattern: /HAS_REFERENCES:?(.*)/, build: (m) => new ApiError("CONFLICT", m[1]?.trim() || "This is still in use, so it can't be deleted.") },
  { pattern: /INVALID_TRANSITION/, build: () => new ApiError("CONFLICT", "That status change isn't allowed from the order's current status.") },
  { pattern: /ORDER_FINAL/, build: () => new ApiError("CONFLICT", "This order is already delivered or cancelled and can't be changed.") },
  { pattern: /ORDER_NOT_PAID/, build: () => new ApiError("CONFLICT", "Only paid orders can move through fulfilment.") },
  { pattern: /NOT_CANCELLABLE/, build: () => new ApiError("CONFLICT", "This order can no longer be cancelled.") },
  { pattern: /BELOW_RESERVED/, build: () => new ApiError("CONFLICT", "That would drop stock below the units already reserved for open checkouts.") },
  { pattern: /NEGATIVE_STOCK/, build: () => new ApiError("CONFLICT", "Stock can't go below zero.") },
  { pattern: /COUPON_(\w+)/, build: (m) => new ApiError("VALIDATION", couponMessage(m[1] ?? ""), { coupon: m[1] }) },
];

function couponMessage(reason: string): string {
  switch (reason) {
    case "NOT_FOUND":
    case "INACTIVE":
      return "That coupon code isn't valid.";
    case "NOT_STARTED":
      return "That coupon isn't active yet.";
    case "EXPIRED":
      return "That coupon has expired.";
    case "MIN_ORDER":
      return "Your order is below the minimum amount for that coupon.";
    case "EXHAUSTED":
      return "That coupon has reached its usage limit.";
    case "USED":
      return "You've already used that coupon the maximum number of times.";
    default:
      return "That coupon can't be applied.";
  }
}

/** Human names for unique constraints, so a duplicate reads "That SKU is already in use." */
const CONSTRAINT_LABEL: Record<string, string> = {
  products_pkey: "URL slug",
  products_sku_uq: "SKU",
  categories_slug_uq: "slug",
  categories_name_uq: "name",
  promotions_code_uq: "coupon code",
  cms_pages_slug_uq: "page slug",
  admin_members_email_live_uq: "email",
};

/** Maps exceptions raised by our SQL functions to ApiErrors. Anything unrecognised becomes a generic 500. */
export function mapDatabaseError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message = error instanceof Error ? error.message : String(error);
  for (const { pattern, build } of SQL_ERRORS) {
    const match = message.match(pattern);
    if (match) return build(match);
  }
  // Constraint violations that no SQL function pre-empted. The constraint name never reaches the client.
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") {
    const constraint = (error as { constraint?: string }).constraint ?? "";
    const label = CONSTRAINT_LABEL[constraint];
    return new ApiError("CONFLICT", label ? `That ${label} is already in use.` : "That value is already in use.");
  }
  if (code === "23503") return new ApiError("CONFLICT", "That record is still referenced elsewhere, so the change isn't possible.");
  if (code === "23514" || code === "22P02" || code === "22003") return new ApiError("VALIDATION", "Please check the values you entered.");
  // Never leak SQL details to the client.
  console.error("[db] unexpected error:", message);
  return new ApiError("INTERNAL", "Something went wrong on our side. Please try again.");
}
