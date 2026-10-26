"use client";

import { useEffect } from "react";
import { buildCartLines } from "@/lib/commerce/pricing";
import { getProducts } from "@/lib/services/products";
import { useBuyNowStore } from "@/lib/stores/buy-now-store";
import { useCartStore } from "@/lib/stores/cart-store";

/**
 * Reads the persisted cart (and any in-progress Buy Now item) once, after mount, then reconciles
 * it with the catalog: removes products that no longer exist or are out of
 * stock, and lowers quantities that now exceed availability.
 */
export function CartHydrator() {
  useEffect(() => {
    void (async () => {
      await Promise.all([useCartStore.persist.rehydrate(), useBuyNowStore.persist.rehydrate()]);
      try {
        const products = await getProducts();
        const { items, setQuantity, removeItem } = useCartStore.getState();
        const valid = new Map(
          buildCartLines(items, products).map((line) => [line.product.id, line.quantity]),
        );
        for (const item of items) {
          const allowed = valid.get(item.productId);
          if (allowed === undefined) removeItem(item.productId);
          else if (allowed < item.quantity) setQuantity(item.productId, allowed, allowed);
        }
      } catch {
        // Catalog unavailable: keep the cart as-is; the cart page shows an error state.
      }
    })();
  }, []);
  return null;
}
