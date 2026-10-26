"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { selectItemCount, useCartStore } from "@/lib/stores/cart-store";

export function CartButton() {
  const count = useCartStore(selectItemCount);
  const hydrated = useCartStore((state) => state.hydrated);
  const visibleCount = hydrated ? count : 0;

  return (
    <Link
      href="/cart"
      aria-label={visibleCount > 0 ? `Cart, ${visibleCount} ${visibleCount === 1 ? "item" : "items"}` : "Cart, empty"}
      className="relative flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-soft"
    >
      <ShoppingCart className="size-6" aria-hidden />
      {visibleCount > 0 ? (
        <span
          aria-hidden
          className="absolute top-0.5 right-0 flex min-w-5 items-center justify-center rounded-full bg-brand-yellow px-1 text-[0.7rem] leading-5 font-bold text-ink ring-2 ring-white"
        >
          {visibleCount > 99 ? "99+" : visibleCount}
        </span>
      ) : null}
    </Link>
  );
}
