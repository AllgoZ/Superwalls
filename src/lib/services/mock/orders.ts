import { commerceConfig } from "@/lib/config/commerce";
import { buildCartLines, calculateTotals } from "@/lib/commerce/pricing";
import { addressSchema } from "@/lib/validation/schemas";
import type { CartLine, CreateOrderInput, Order, OrderItem, OrderStatus } from "@/lib/types";
import { emitDataChange } from "../events";
import { ServiceError } from "../errors";
import type { OrdersRepository } from "../contracts";
import { processPayment } from "../payments";
import { DEMO_PRODUCTS } from "./catalog";
import { generateId } from "@/lib/id";
import { delay, readStored, STORAGE_KEYS, writeStored } from "./storage";

function toOrderItems(lines: CartLine[]): OrderItem[] {
  return lines.map((line) => ({
    productId: line.product.id,
    name: line.product.name,
    imageSrc: line.product.images[0]?.src,
    unitPricePaise: line.product.pricePaise,
    quantity: line.quantity,
    lineTotalPaise: line.lineTotalPaise,
  }));
}

const DEMO_ADDRESS = {
  fullName: "Demo Customer",
  mobile: "9000000000",
  line1: "12, Sample Street",
  area: "Demo Colony",
  city: "Sampletown",
  state: "Karnataka",
  pincode: "560001",
  instructions: "",
};

function seedOrder(params: {
  n: number;
  daysAgo: number;
  status: OrderStatus;
  items: { productId: string; quantity: number }[];
  paymentStatus: Order["paymentStatus"];
}): Order {
  const lines = buildCartLines(params.items, DEMO_PRODUCTS);
  const totals = calculateTotals(lines, commerceConfig);
  const created = new Date(Date.UTC(2026, 9, 17, 6, 30) - params.daysAgo * 86_400_000);
  const timeline: OrderStatus[] = ["placed", "confirmed", "processing", "shipped", "out_for_delivery", "delivered"];
  const reached: OrderStatus[] =
    params.status === "cancelled"
      ? ["placed", "cancelled"]
      : timeline.slice(0, timeline.indexOf(params.status) + 1);
  return {
    id: `demo-order-${params.n}`,
    orderNumber: `SW-DEMO-SEED-${1000 + params.n}`,
    createdAt: created.toISOString(),
    status: params.status,
    statusHistory: reached.map((status, index) => ({
      status,
      at: new Date(created.getTime() + index * 6 * 3_600_000).toISOString(),
    })),
    paymentMethod: "cod",
    paymentStatus: params.paymentStatus,
    items: toOrderItems(lines),
    subtotalPaise: totals.subtotalPaise,
    discountPaise: totals.discountPaise,
    deliveryPaise: totals.deliveryPaise,
    totalPaise: totals.totalPaise,
    address: DEMO_ADDRESS,
    isDemo: true,
  };
}

/** Sample orders so the Orders page has something to show before any real order exists. */
const SEED_ORDERS: Order[] = [
  seedOrder({
    n: 1,
    daysAgo: 1,
    status: "out_for_delivery",
    paymentStatus: "pending",
    items: [
      { productId: "demo-floor-cleaner", quantity: 2 },
      { productId: "demo-microfibre-cloths", quantity: 1 },
    ],
  }),
  seedOrder({
    n: 2,
    daysAgo: 12,
    status: "delivered",
    paymentStatus: "paid",
    items: [
      { productId: "demo-glass-cleaner", quantity: 1 },
      { productId: "demo-dishwash-liquid", quantity: 3 },
      { productId: "demo-bathroom-cleaner", quantity: 1 },
    ],
  }),
  seedOrder({
    n: 3,
    daysAgo: 30,
    status: "cancelled",
    paymentStatus: "refunded",
    items: [{ productId: "demo-bathroom-cleaner", quantity: 1 }],
  }),
];

function readCreatedOrders(): Order[] {
  return readStored<Order[]>(STORAGE_KEYS.orders, []);
}

function generateOrderNumber(now: Date): string {
  const yyyymmdd = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SW-DEMO-${yyyymmdd}-${suffix}`;
}

export const mockOrders: OrdersRepository = {
  async list() {
    await delay(250);
    return [...readCreatedOrders(), ...SEED_ORDERS].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  async getById(id) {
    await delay(150);
    return [...readCreatedOrders(), ...SEED_ORDERS].find((order) => order.id === id) ?? null;
  },

  async create(input: CreateOrderInput) {
    await delay(900);

    // Idempotency: the same client request id always returns the same order.
    const keys = readStored<Record<string, string>>(STORAGE_KEYS.orderKeys, {});
    const existingId = keys[input.clientRequestId];
    if (existingId) {
      const existing = readCreatedOrders().find((order) => order.id === existingId);
      if (existing) return existing;
    }

    const parsedAddress = addressSchema.safeParse(input.address);
    if (!parsedAddress.success) {
      throw new ServiceError("VALIDATION", "Please check your delivery details.");
    }
    if (input.items.length === 0) {
      throw new ServiceError("EMPTY_CART", "Your cart is empty.");
    }

    // Prices, stock and totals come from the catalog, never from the client.
    const lines = buildCartLines(input.items, DEMO_PRODUCTS);
    const requestedUnits = input.items.reduce((sum, item) => sum + item.quantity, 0);
    const resolvedUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
    if (lines.length !== input.items.length || resolvedUnits !== requestedUnits) {
      throw new ServiceError(
        "OUT_OF_STOCK",
        "Some items are no longer available in the requested quantity. Please review your cart.",
      );
    }

    const totals = calculateTotals(lines, commerceConfig);
    const id = generateId("order");
    const payment = await processPayment({
      orderReference: id,
      method: input.paymentMethod,
      amountPaise: totals.totalPaise,
    });

    const now = new Date();
    const order: Order = {
      id,
      orderNumber: generateOrderNumber(now),
      createdAt: now.toISOString(),
      status: "placed",
      statusHistory: [{ status: "placed", at: now.toISOString() }],
      paymentMethod: input.paymentMethod,
      paymentStatus: payment.status,
      items: toOrderItems(lines),
      subtotalPaise: totals.subtotalPaise,
      discountPaise: totals.discountPaise,
      deliveryPaise: totals.deliveryPaise,
      totalPaise: totals.totalPaise,
      address: parsedAddress.data,
      isDemo: true,
    };

    writeStored(STORAGE_KEYS.orders, [order, ...readCreatedOrders()]);
    writeStored(STORAGE_KEYS.orderKeys, { ...keys, [input.clientRequestId]: id });
    emitDataChange();
    return order;
  },
};
