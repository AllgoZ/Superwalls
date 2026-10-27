import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/common/states";
import { TrackOrder } from "@/components/orders/track-order";

export const metadata: Metadata = { title: "Track an order", robots: { index: false } };

export default function TrackPage({ searchParams }: PageProps<"/track">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="mb-1 text-2xl font-extrabold text-ink">Track an order</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Ordered without an account? Enter your order number and the tracking code from your private tracking link.
      </p>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        {searchParams.then(({ o }) => (
          <TrackOrder initialOrderNumber={typeof o === "string" ? o : ""} />
        ))}
      </Suspense>
    </div>
  );
}
