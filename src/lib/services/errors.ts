export type ServiceErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "EMPTY_CART"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "PAYMENT_NOT_CONFIGURED"
  | "PAYMENT_PROVIDER_ERROR"
  | "ALREADY_PAID"
  | "ORDER_NOT_PAYABLE"
  | "RATE_LIMITED"
  | "MIN_ORDER"
  | "NOT_SERVICEABLE"
  | "UNAUTHENTICATED"
  | "BACKEND_NOT_CONFIGURED"
  | "NETWORK"
  | "UNKNOWN";

/** Error thrown by every service. UI code branches on `code`, never on message text. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function toErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ServiceError) return error.message;
  return fallback;
}
