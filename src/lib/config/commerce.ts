import type { Paise } from "@/lib/types";

/**
 * Built-in commerce defaults. The live delivery rules are edited in the admin panel (Settings > Delivery) and read
 * from the database; these values are only the fallback when that row is unavailable. There is no automatic
 * discount: promotions are coupons created in the admin panel and validated by the server. Payment is online-only;
 * there is no Cash on Delivery.
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
  /** Orders below this subtotal are refused by the server (0 = no minimum). */
  minOrderPaise: Paise;
  /** Upper bound per cart line, in addition to each product's stock. Enforced again by the database. */
  maxQuantityPerItem: number;
}

export const commerceConfig: CommerceConfig = {
  deliveryFeePaise: 4900,
  freeDeliveryThresholdPaise: 49900,
  discount: null,
  minOrderPaise: 0,
  maxQuantityPerItem: 10,
};
