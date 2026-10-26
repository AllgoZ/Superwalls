import type { Paise, PaymentMethod } from "@/lib/types";

/**
 * Commerce policy. Every value here is a DEMO placeholder: the real delivery,
 * discount and payment policies have not been specified yet.
 */
export interface CommerceConfig {
  /** Flat delivery charge. */
  deliveryFeePaise: Paise;
  /** Delivery is free at or above this subtotal. Set to null to always charge. */
  freeDeliveryThresholdPaise: Paise | null;
  /** Percentage discount applied when the subtotal reaches the minimum. Set to null to disable. */
  discount: {
    label: string;
    minSubtotalPaise: Paise;
    percentOff: number;
    maxDiscountPaise: Paise;
  } | null;
  /** Upper bound per cart line, in addition to each product's stock. */
  maxQuantityPerItem: number;
  paymentMethods: PaymentMethod[];
}

export const commerceConfig: CommerceConfig = {
  deliveryFeePaise: 4900,
  freeDeliveryThresholdPaise: 49900,
  discount: {
    label: "Demo discount",
    minSubtotalPaise: 79900,
    percentOff: 5,
    maxDiscountPaise: 10000,
  },
  maxQuantityPerItem: 10,
  paymentMethods: [
    {
      id: "cod",
      label: "Cash on Delivery",
      description: "Pay in cash when your order arrives.",
      enabled: true,
    },
    {
      id: "online",
      label: "Pay online (UPI / cards)",
      description: "Secure online payment.",
      enabled: false,
      unavailableReason: "Online payment is not available yet.",
    },
  ],
};
