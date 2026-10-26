import { commerceConfig, type CommerceConfig } from "@/lib/config/commerce";
import type { CartItem, CartLine, CartTotals, Product, StockState } from "@/lib/types";

/** Joins cart items with catalog products. Items whose product no longer exists are dropped. */
export function buildCartLines(items: CartItem[], products: Product[]): CartLine[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: CartLine[] = [];
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) continue;
    const quantity = clampQuantity(item.quantity, product);
    if (quantity < 1) continue;
    lines.push({ product, quantity, lineTotalPaise: product.pricePaise * quantity });
  }
  return lines;
}

/**
 * The single source of truth for cart/checkout/order totals. All values are
 * integer paise, so there is no floating-point drift.
 */
export function calculateTotals(
  lines: Pick<CartLine, "lineTotalPaise" | "quantity">[],
  config: CommerceConfig = commerceConfig,
): CartTotals {
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);

  let discountPaise = 0;
  if (config.discount && subtotalPaise >= config.discount.minSubtotalPaise) {
    discountPaise = Math.min(
      Math.floor((subtotalPaise * config.discount.percentOff) / 100),
      config.discount.maxDiscountPaise,
    );
  }

  const threshold = config.freeDeliveryThresholdPaise;
  const qualifiesForFreeDelivery = threshold !== null && subtotalPaise >= threshold;
  const deliveryPaise =
    itemCount === 0 || qualifiesForFreeDelivery ? 0 : config.deliveryFeePaise;

  const amountToFreeDeliveryPaise =
    itemCount > 0 && threshold !== null && !qualifiesForFreeDelivery
      ? threshold - subtotalPaise
      : 0;

  return {
    itemCount,
    subtotalPaise,
    discountPaise,
    deliveryPaise,
    totalPaise: Math.max(0, subtotalPaise - discountPaise + deliveryPaise),
    amountToFreeDeliveryPaise,
  };
}

/** Largest quantity a customer may hold of this product. */
export function maxQuantityFor(product: Product, config: CommerceConfig = commerceConfig): number {
  return Math.max(0, Math.min(product.stock, config.maxQuantityPerItem));
}

/** Coerces any value into a valid integer quantity within [0, max for product]. */
export function clampQuantity(
  quantity: number,
  product: Product,
  config: CommerceConfig = commerceConfig,
): number {
  if (!Number.isFinite(quantity)) return 0;
  return Math.min(Math.max(0, Math.floor(quantity)), maxQuantityFor(product, config));
}

const LOW_STOCK_THRESHOLD = 5;

export function getStockState(product: Pick<Product, "stock">): StockState {
  if (product.stock <= 0) return "out_of_stock";
  if (product.stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

export function getDiscountPercent(product: Pick<Product, "pricePaise" | "compareAtPricePaise">): number {
  const compareAt = product.compareAtPricePaise;
  if (!compareAt || compareAt <= product.pricePaise) return 0;
  return Math.round(((compareAt - product.pricePaise) / compareAt) * 100);
}
