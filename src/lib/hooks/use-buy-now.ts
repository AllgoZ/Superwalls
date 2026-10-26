"use client";

import { useMemo } from "react";
import { buildCartLines, calculateTotals } from "@/lib/commerce/pricing";
import { getProducts } from "@/lib/services/products";
import { useBuyNowStore } from "@/lib/stores/buy-now-store";
import { useServiceQuery } from "./use-service-query";

/** Same shape as `useCart()`, but for the single "Buy Now" item. */
export function useBuyNow() {
  const item = useBuyNowStore((state) => state.item);
  const hydrated = useBuyNowStore((state) => state.hydrated);
  const products = useServiceQuery(getProducts);

  const lines = useMemo(
    () => (products.data && item ? buildCartLines([item], products.data) : []),
    [item, products.data],
  );
  const totals = useMemo(() => calculateTotals(lines), [lines]);

  const status = products.status === "error" ? "error" : hydrated && products.data ? "ready" : "loading";

  return { status, lines, totals, reload: products.reload } as const;
}
