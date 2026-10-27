"use client";

import { useMemo } from "react";
import { buildCartLines, calculateTotals } from "@/lib/commerce/pricing";
import { getProducts } from "@/lib/services/products";
import { useCartStore } from "@/lib/stores/cart-store";
import { useCommerceConfig } from "./use-commerce-config";
import { useServiceQuery } from "./use-service-query";

/**
 * The cart joined with catalog data and totals. `status` is "loading" until
 * both the persisted cart and the catalog are available, so pages can show a
 * skeleton instead of flashing an empty cart.
 */
export function useCart() {
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state.hydrated);
  const products = useServiceQuery(getProducts);

  const lines = useMemo(
    () => (products.data ? buildCartLines(items, products.data) : []),
    [items, products.data],
  );
  const config = useCommerceConfig();
  const totals = useMemo(() => calculateTotals(lines, config), [lines, config]);

  const status = products.status === "error" ? "error" : hydrated && products.data ? "ready" : "loading";

  return { status, lines, totals, reload: products.reload } as const;
}
