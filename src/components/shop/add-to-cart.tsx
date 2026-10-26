"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { maxQuantityFor } from "@/lib/commerce/pricing";
import { getCartQuantity, useCartStore } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";
import { BuySheet } from "./buy-sheet";

/**
 * Card action. One tap opens the quantity sheet, where the default choice is
 * Buy Now and "Add to Cart" is the secondary option.
 */
export function AddToCart({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const items = useCartStore((state) => state.items);
  const inCart = getCartQuantity(items, product.id);

  if (maxQuantityFor(product) < 1) {
    return (
      <Button variant="secondary" className="w-full" disabled>
        Out of stock
      </Button>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button className="w-full" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <ShoppingBag aria-hidden />
        Buy Now
        <span className="sr-only"> {product.name}</span>
      </Button>
      {inCart > 0 ? (
        <p className="text-center text-xs font-medium text-muted-foreground">{inCart} in your cart</p>
      ) : null}
      <BuySheet product={product} open={open} onOpenChange={setOpen} />
    </div>
  );
}
