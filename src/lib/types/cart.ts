import type { Product } from "./product";

/** What is persisted: ids and quantities only. Prices always come from the catalog. */
export interface CartItem {
  productId: string;
  quantity: number;
}

/** A cart item joined with its catalog product. */
export interface CartLine {
  product: Product;
  quantity: number;
  lineTotalPaise: number;
}

export interface CartTotals {
  itemCount: number;
  subtotalPaise: number;
  discountPaise: number;
  deliveryPaise: number;
  totalPaise: number;
  /** Amount still needed for free delivery, or 0 if already free / not applicable. */
  amountToFreeDeliveryPaise: number;
}
