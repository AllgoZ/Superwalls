import type { AddressFields } from "./customer";
import type { Paise } from "./product";

/** Fulfilment lifecycle. Kept separate from payment status on purpose. */
export const ORDER_STATUSES = [
  "pending_payment",
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "initiated",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type CustomerType = "registered" | "guest";

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
  /** Human-friendly reference shown to customers. Not a secret and never used as authentication. */
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  paymentStatus: PaymentStatus;
  customerType: CustomerType;
  items: OrderItem[];
  subtotalPaise: Paise;
  discountPaise: Paise;
  deliveryPaise: Paise;
  totalPaise: Paise;
  /** Address snapshot taken at order time. */
  address: AddressFields;
}
