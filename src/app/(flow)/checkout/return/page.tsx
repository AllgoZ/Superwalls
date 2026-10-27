import type { Metadata } from "next";
import { Suspense } from "react";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { ListSkeleton } from "@/components/common/states";
import { PaymentReturn } from "@/components/checkout/payment-return";
import { ORDER_NUMBER_REGEX } from "@/lib/checkout/contract";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

export default function CheckoutReturnPage({ searchParams }: PageProps<"/checkout/return">) {
  return (
    <>
      <MobileTopBar title="Payment status" backHref="/" backLabel="Back to shop" hideCart />
      <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 md:pt-8">
        <h1 className="mb-6 hidden text-2xl font-extrabold text-ink md:block">Payment status</h1>
        {/* The order number is a request-time value, so it is read behind a Suspense boundary. */}
        <Suspense fallback={<ListSkeleton rows={3} />}>
          {searchParams.then(({ order }) => {
            const orderNumber = typeof order === "string" ? order : "";
            return ORDER_NUMBER_REGEX.test(orderNumber) ? (
              <PaymentReturn orderNumber={orderNumber} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">That payment link isn&apos;t valid.</p>
            );
          })}
        </Suspense>
      </div>
    </>
  );
}
