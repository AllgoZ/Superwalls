import type { Metadata } from "next";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = { title: "Your Cart" };

export default function CartPage() {
  return (
    <>
      <MobileTopBar title="Your Cart" backHref="/" backLabel="Back to home" hideCart />
      <div className="mx-auto max-w-5xl md:px-6 md:pt-8">
        <h1 className="mb-6 hidden text-2xl font-extrabold text-ink md:block">Your Cart</h1>
        <CartView />
      </div>
    </>
  );
}
