import { commerceConfig } from "@/lib/config/commerce";
import type { PaymentMethod, PaymentMethodId } from "@/lib/types";
import { ServiceError } from "./errors";
import type { PaymentProvider, PaymentRequest, PaymentResult } from "./contracts";

/**
 * Payment execution lives behind `PaymentProvider`. Nothing here simulates a
 * gateway: Cash on Delivery needs no payment step, and online payment has no
 * provider yet, so it refuses rather than pretending to succeed. Never collect
 * or store card details in this app; a hosted gateway checkout will do that.
 */
const codProvider: PaymentProvider = {
  method: "cod",
  async process(): Promise<PaymentResult> {
    // Nothing is collected now; the customer pays on delivery.
    return { status: "pending" };
  },
};

const providers: Partial<Record<PaymentMethodId, PaymentProvider>> = {
  cod: codProvider,
  // online: register a gateway-backed provider here when one is chosen.
};

export function getPaymentMethods(): PaymentMethod[] {
  return commerceConfig.paymentMethods;
}

export function getEnabledPaymentMethods(): PaymentMethod[] {
  return getPaymentMethods().filter((method) => method.enabled);
}

export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
  const configured = getPaymentMethods().find((method) => method.id === request.method);
  const provider = providers[request.method];
  if (!configured?.enabled || !provider) {
    throw new ServiceError("PAYMENT_UNAVAILABLE", "This payment method is not available right now.");
  }
  return provider.process(request);
}
