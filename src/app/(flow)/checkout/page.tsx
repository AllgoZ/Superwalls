import type { Metadata } from "next";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <>
      <MobileTopBar title="Checkout" backHref="/cart" backLabel="Back to cart" hideCart />
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:pt-8">
        <h1 className="mb-6 hidden text-2xl font-extrabold text-ink md:block">Checkout</h1>
        <CheckoutFlow />
      </div>
    </>
  );
}
