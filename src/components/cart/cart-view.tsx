"use client";

import Link from "next/link";
import { ShoppingBag, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProductImage } from "@/components/common/product-image";
import { QuantityStepper } from "@/components/common/quantity-stepper";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { maxQuantityFor } from "@/lib/commerce/pricing";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/formatters";
import { useCart } from "@/lib/hooks/use-cart";
import { useCartStore } from "@/lib/stores/cart-store";
import type { CartLine } from "@/lib/types";
import { OrderSummary } from "./order-summary";

function CartLineItem({ line }: { line: CartLine }) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const addItem = useCartStore((state) => state.addItem);
  const { product, quantity } = line;
  const max = maxQuantityFor(product);
  const image = product.images[0];

  function handleRemove() {
    removeItem(product.id);
    toast(`${product.name} removed`, {
      action: { label: "Undo", onClick: () => addItem(product.id, max, quantity) },
    });
  }

  return (
    <li className="flex gap-3 rounded-2xl border bg-white p-3">
      <Link href={`/products/${product.id}`} className="w-20 shrink-0 self-start sm:w-24">
        <ProductImage
          src={image?.src}
          alt={image?.alt ?? product.name}
          sizes="96px"
          className="rounded-xl"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold text-ink">
              <Link href={`/products/${product.id}`}>{product.name}</Link>
            </h3>
            <p className="text-xs text-muted-foreground">
              {product.unit} · {formatINR(product.pricePaise)} each
            </p>
          </div>
          <p className="text-sm font-bold tabular-nums text-ink">{formatINR(line.lineTotalPaise)}</p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <QuantityStepper
            value={quantity}
            min={1}
            max={max}
            label={product.name}
            onChange={(next) => setQuantity(product.id, next, max)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            aria-label={`Remove ${product.name} from cart`}
            className="text-muted-foreground hover:text-danger"
          >
            <Trash2 aria-hidden />
            Remove
          </Button>
        </div>
        {quantity >= max ? (
          <p className="text-xs text-muted-foreground">Maximum available quantity</p>
        ) : null}
      </div>
    </li>
  );
}

export function CartView() {
  const cart = useCart();

  if (cart.status === "loading") {
    return (
      <div className="px-4 py-4 md:px-0">
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (cart.status === "error") {
    return <ErrorState onRetry={cart.reload} />;
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag />}
        title="Your cart is empty"
        description="Add a few essentials and they'll show up here."
        action={
          <Link href="/#products" className={buttonVariants({ size: "lg" })}>
            Continue Shopping
          </Link>
        }
      />
    );
  }

  const { totals } = cart;

  return (
    <div className="px-4 pt-4 pb-36 md:grid md:grid-cols-[1fr_22rem] md:items-start md:gap-8 md:px-0 md:pt-0 md:pb-0">
      <div className="space-y-3">
        {totals.amountToFreeDeliveryPaise > 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-brand-yellow-soft px-3 py-2.5 text-sm text-ink">
            <Truck className="size-4 shrink-0" aria-hidden />
            <span>
              Add <strong>{formatINR(totals.amountToFreeDeliveryPaise)}</strong> more for free delivery.
            </span>
          </p>
        ) : totals.deliveryPaise === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
            <Truck className="size-4 shrink-0" aria-hidden />
            You&apos;ve unlocked free delivery.
          </p>
        ) : null}
        <ul className="space-y-3" aria-label="Cart items">
          {cart.lines.map((line) => (
            <CartLineItem key={line.product.id} line={line} />
          ))}
        </ul>
      </div>

      <aside
        aria-label="Order summary"
        className="mt-4 rounded-2xl border bg-white p-4 md:sticky md:top-24 md:mt-0"
      >
        <h2 className="mb-3 text-base font-bold text-ink">Order summary</h2>
        <OrderSummary totals={totals} />
        <Link
          href="/checkout"
          className={cn(buttonVariants({ size: "lg" }), "mt-4 hidden w-full md:inline-flex")}
        >
          Proceed to Checkout
        </Link>
        <Link
          href="/#products"
          className="mt-3 hidden text-center text-sm font-semibold text-brand-blue hover:underline md:block"
        >
          Continue Shopping
        </Link>
      </aside>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-white px-4 pt-3 pb-3 md:hidden">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-extrabold tabular-nums text-ink">{formatINR(totals.totalPaise)}</span>
        </div>
        <Link href="/checkout" className={`${buttonVariants({ size: "lg" })} w-full`}>
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
