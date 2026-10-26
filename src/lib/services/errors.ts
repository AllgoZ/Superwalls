export type ServiceErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "EMPTY_CART"
  | "OUT_OF_STOCK"
  | "PAYMENT_UNAVAILABLE"
  | "UNAUTHENTICATED"
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
