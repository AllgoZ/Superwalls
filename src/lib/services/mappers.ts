import type { OrderPayload } from "@/lib/checkout/contract";
import type { AddressFields, CustomerType, Order, OrderStatus, PaymentStatus } from "@/lib/types";

/** The server's `order_json()` payload (guest tracking) -> the app's Order. */
export function orderFromPayload(payload: OrderPayload): Order {
  return {
    id: payload.id,
    orderNumber: payload.orderNumber,
    createdAt: payload.createdAt,
    status: payload.orderStatus as OrderStatus,
    statusHistory: payload.events.map((event) => ({ status: event.status as OrderStatus, at: event.at })),
    paymentStatus: payload.paymentStatus as PaymentStatus,
    customerType: payload.customerType,
    items: payload.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      imageSrc: item.imageSrc ?? undefined,
      unitPricePaise: Number(item.unitPricePaise),
      quantity: item.quantity,
      lineTotalPaise: Number(item.lineTotalPaise),
    })),
    subtotalPaise: Number(payload.subtotalPaise),
    discountPaise: Number(payload.discountPaise),
    deliveryPaise: Number(payload.deliveryPaise),
    totalPaise: Number(payload.totalPaise),
    address: payload.address,
  };
}

/** A row read through RLS (snake_case, with embedded items and events) -> the app's Order. */
export interface OrderRow {
  id: string;
  order_number: string;
  customer_type: CustomerType;
  created_at: string;
  order_status: string;
  payment_status: string;
  subtotal_paise: number;
  discount_paise: number;
  delivery_paise: number;
  total_paise: number;
  address_snapshot: AddressFields;
  order_items: {
    product_id: string;
    name: string;
    image_src: string | null;
    unit_price_paise: number;
    quantity: number;
    line_total_paise: number;
  }[];
  order_status_events: { status: string; created_at: string }[];
}

export const ORDER_ROW_COLUMNS =
  "id,order_number,customer_type,created_at,order_status,payment_status,subtotal_paise,discount_paise,delivery_paise,total_paise,address_snapshot," +
  "order_items(product_id,name,image_src,unit_price_paise,quantity,line_total_paise)," +
  "order_status_events(status,created_at)";

export function orderFromRow(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    status: row.order_status as OrderStatus,
    statusHistory: [...row.order_status_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((event) => ({ status: event.status as OrderStatus, at: event.created_at })),
    paymentStatus: row.payment_status as PaymentStatus,
    customerType: row.customer_type,
    items: row.order_items.map((item) => ({
      productId: item.product_id,
      name: item.name,
      imageSrc: item.image_src ?? undefined,
      unitPricePaise: Number(item.unit_price_paise),
      quantity: item.quantity,
      lineTotalPaise: Number(item.line_total_paise),
    })),
    subtotalPaise: Number(row.subtotal_paise),
    discountPaise: Number(row.discount_paise),
    deliveryPaise: Number(row.delivery_paise),
    totalPaise: Number(row.total_paise),
    address: row.address_snapshot,
  };
}
