"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/common/quantity-stepper";
import { maxQuantityFor } from "@/lib/commerce/pricing";
import { formatINR } from "@/lib/formatters";
import { useBuyNowStore } from "@/lib/stores/buy-now-store";
import { getCartQuantity, useCartStore } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";

/**
 * Quantity selector + Buy Now (default) + add-to-cart for the product page.
 * Sticks to the bottom of the screen on mobile (this route has no bottom nav)
 * and sits inline on desktop.
 */
export function PurchasePanel({ product }: { product: Product }) {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const startBuyNow = useBuyNowStore((state) => state.start);
  const [quantity, setQuantity] = useState(1);

  const max = maxQuantityFor(product);
  const inCart = getCartQuantity(items, product.id);
  const canAddToCart = max - inCart > 0;

  const cartNote =
    inCart > 0 ? (
      <p className="text-sm text-muted-foreground">
        {inCart} in your cart ·{" "}
        <Link href="/cart" className="font-semibold text-brand-blue underline-offset-2 hover:underline">
          View cart
        </Link>
      </p>
    ) : null;

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-30 space-y-2 border-t bg-white px-4 pt-3 pb-3 md:static md:space-y-3 md:border-0 md:bg-transparent md:p-0">
      {cartNote}
      {max < 1 ? (
        <Button size="lg" variant="secondary" className="w-full" disabled>
          Out of stock
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <QuantityStepper
            size="lg"
            value={quantity}
            max={max}
            label={product.name}
            onChange={setQuantity}
          />
          <Button
            size="lg"
            variant="outline"
            className="shrink-0 px-0 max-sm:size-12"
            disabled={!canAddToCart}
            aria-label={canAddToCart ? "Add to cart" : "Maximum quantity already in cart"}
            onClick={() => {
              const toAdd = Math.min(quantity, max - inCart);
              addItem(product.id, max, toAdd);
              setQuantity(1);
              toast.success(
                toAdd === 1 ? `${product.name} added to cart` : `${toAdd} × ${product.name} added to cart`,
                { action: { label: "View cart", onClick: () => router.push("/cart") } },
              );
            }}
          >
            <ShoppingCart aria-hidden />
            <span className="hidden sm:inline sm:px-2">Add to Cart</span>
          </Button>
          <Button
            size="lg"
            className="min-w-0 flex-1"
            onClick={() => {
              startBuyNow(product.id, quantity);
              router.push("/buy");
            }}
          >
            <ShoppingBag aria-hidden />
            Buy Now · {formatINR(product.pricePaise * quantity)}
          </Button>
        </div>
      )}
    </div>
  );
}
