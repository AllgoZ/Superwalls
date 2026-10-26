"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

interface BuyNowState {
  /** The single product being bought right now, kept separate from the cart. */
  item: CartItem | null;
  /** False until persisted data has been read on the client. */
  hydrated: boolean;
  start: (productId: string, quantity: number) => void;
  clear: () => void;
}

/**
 * "Buy Now" selection. Lives in sessionStorage so a refresh during checkout
 * keeps the item, but a new tab/session starts clean. The cart is untouched.
 */
export const useBuyNowStore = create<BuyNowState>()(
  persist(
    (set) => ({
      item: null,
      hydrated: false,
      start: (productId, quantity) =>
        set({ item: { productId, quantity: Math.max(1, Math.floor(quantity)) } }),
      clear: () => set({ item: null }),
    }),
    {
      name: "sw-buy-now",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ item: state.item }),
      skipHydration: true,
      merge: (persisted, current) => {
        const item = (persisted as Partial<BuyNowState> | undefined)?.item;
        const valid =
          item &&
          typeof item.productId === "string" &&
          typeof item.quantity === "number" &&
          Number.isFinite(item.quantity) &&
          item.quantity >= 1;
        return { ...current, item: valid ? { productId: item.productId, quantity: Math.floor(item.quantity) } : null };
      },
      onRehydrateStorage: () => () => {
        useBuyNowStore.setState({ hydrated: true });
      },
    },
  ),
);
