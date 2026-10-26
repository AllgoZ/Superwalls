"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Price } from "@/components/common/price";
import { ProductImage } from "@/components/common/product-image";
import { QuantityStepper } from "@/components/common/quantity-stepper";
import { maxQuantityFor } from "@/lib/commerce/pricing";
import { formatINR } from "@/lib/formatters";
import { useBuyNowStore } from "@/lib/stores/buy-now-store";
import { useCartStore } from "@/lib/stores/cart-store";
import type { Product } from "@/lib/types";

function BuySheetBody({ product, onClose }: { product: Product; onClose: () => void }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const startBuyNow = useBuyNowStore((state) => state.start);
  const [quantity, setQuantity] = useState(1);

  const max = maxQuantityFor(product);
  const image = product.images[0];

  function buyNow() {
    startBuyNow(product.id, quantity);
    onClose();
    router.push("/buy");
  }

  function addToCart() {
    addItem(product.id, max, quantity);
    onClose();
    toast.success(
      quantity === 1 ? `${product.name} added to cart` : `${quantity} × ${product.name} added to cart`,
      { action: { label: "View cart", onClick: () => router.push("/cart") } },
    );
  }

  return (
    <div className="space-y-4 px-4 pb-5">
      <div className="flex items-center gap-3">
        <ProductImage
          src={image?.src}
          alt={image?.alt ?? product.name}
          sizes="72px"
          className="w-[4.5rem] shrink-0 rounded-xl"
        />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-ink">{product.name}</p>
          <p className="text-xs text-muted-foreground">{product.unit}</p>
          <Price
            pricePaise={product.pricePaise}
            compareAtPricePaise={product.compareAtPricePaise}
            size="sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <QuantityStepper
          size="lg"
          value={quantity}
          max={max}
          label={product.name}
          onChange={setQuantity}
        />
        <Button size="lg" className="flex-1" onClick={buyNow}>
          <ShoppingBag aria-hidden />
          Buy Now · {formatINR(product.pricePaise * quantity)}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Delivery charges and discounts are shown at checkout.
      </p>

      <Button variant="outline" size="lg" className="w-full" onClick={addToCart}>
        <ShoppingCart aria-hidden />
        Add to Cart &amp; keep shopping
      </Button>
    </div>
  );
}

interface BuySheetProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Bottom sheet opened from product cards: pick a quantity, then Buy Now (default) or Add to Cart. */
export function BuySheet({ product, open, onOpenChange }: BuySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl pb-safe">
        <SheetHeader>
          <SheetTitle className="text-lg font-bold">Choose quantity</SheetTitle>
          <SheetDescription>Buy this now, or add it to your cart to keep shopping.</SheetDescription>
        </SheetHeader>
        <BuySheetBody product={product} onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
