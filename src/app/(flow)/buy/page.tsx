import type { Metadata } from "next";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = { title: "Buy Now" };

/** Single-product checkout started from the Buy Now sheet. The cart is not involved. */
export default function BuyNowPage() {
  return (
    <>
      <MobileTopBar title="Checkout" backHref="/" backLabel="Back to shopping" hideCart />
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:pt-8">
        <h1 className="mb-6 hidden text-2xl font-extrabold text-ink md:block">Checkout</h1>
        <CheckoutFlow mode="buy" />
      </div>
    </>
  );
}
