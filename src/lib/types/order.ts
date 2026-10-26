import type { AddressFields } from "./customer";
import type { Paise } from "./product";

export const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentMethodId = "cod" | "online";

/** A payment method offered at checkout. Configured in `config/commerce.ts`. */
export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
  /** Disabled methods are shown but cannot be selected. */
  enabled: boolean;
  /** Shown when the method is disabled. */
  unavailableReason?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  imageSrc?: string;
  unitPricePaise: Paise;
  quantity: number;
  lineTotalPaise: Paise;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
}

export interface Order {
  id: string;
  /** Human-friendly reference shown to customers. */
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  paymentMethod: PaymentMethodId;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  subtotalPaise: Paise;
  discountPaise: Paise;
  deliveryPaise: Paise;
  totalPaise: Paise;
  /** Address snapshot taken at order time. */
  address: AddressFields;
  /** True for seeded or mock-created orders. */
  isDemo: boolean;
}

/**
 * Input for creating an order. Deliberately has no prices or totals: the
 * service recomputes them from the catalog so the client is never trusted.
 */
export interface CreateOrderInput {
  items: { productId: string; quantity: number }[];
  address: AddressFields;
  paymentMethod: PaymentMethodId;
  /** Idempotency key: submitting the same key twice returns the same order. */
  clientRequestId: string;
}
