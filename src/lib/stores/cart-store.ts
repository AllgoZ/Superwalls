"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

interface CartState {
  items: CartItem[];
  /** False until persisted data has been read on the client (avoids hydration mismatches). */
  hydrated: boolean;
  /** Adds units, never exceeding `max` (stock / per-item limit). */
  addItem: (productId: string, max: number, quantity?: number) => void;
  /** Sets an exact quantity (0 removes the line), clamped to `max`. */
  setQuantity: (productId: string, quantity: number, max: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

function sanitizeQuantity(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, Math.floor(value)), Math.max(0, Math.floor(max)));
}

/** Drops malformed or duplicate entries from whatever was in localStorage. */
function sanitizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: CartItem[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { productId, quantity } = entry as Partial<CartItem>;
    if (typeof productId !== "string" || typeof quantity !== "number") continue;
    if (seen.has(productId) || !Number.isFinite(quantity) || quantity < 1) continue;
    seen.add(productId);
    items.push({ productId, quantity: Math.floor(quantity) });
  }
  return items;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hydrated: false,

      addItem: (productId, max, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((item) => item.productId === productId);
          const next = sanitizeQuantity((existing?.quantity ?? 0) + quantity, max);
          if (next < 1) return state;
          return {
            items: existing
              ? state.items.map((item) =>
                  item.productId === productId ? { ...item, quantity: next } : item,
                )
              : [...state.items, { productId, quantity: next }],
          };
        }),

      setQuantity: (productId, quantity, max) =>
        set((state) => {
          const next = sanitizeQuantity(quantity, max);
          if (next < 1) {
            return { items: state.items.filter((item) => item.productId !== productId) };
          }
          return {
            items: state.items.map((item) =>
              item.productId === productId ? { ...item, quantity: next } : item,
            ),
          };
        }),

      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "sw-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      // Rehydrated manually from <CartHydrator /> after mount, so server and
      // first client render both start from an empty cart.
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        items: sanitizeItems((persisted as Partial<CartState> | undefined)?.items),
      }),
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hydrated: true });
      },
    },
  ),
);

export const selectItemCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

export function getCartQuantity(items: CartItem[], productId: string): number {
  return items.find((item) => item.productId === productId)?.quantity ?? 0;
}
