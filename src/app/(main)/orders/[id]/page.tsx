import type { Metadata } from "next";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/common/states";
import { OrderDetail } from "@/components/orders/order-detail";

export const metadata: Metadata = { title: "Order details" };

export default function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:pt-8">
      {/* Order ids are only known at request time, so the lookup streams in behind a Suspense boundary. */}
      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-40" />}>
        {params.then(({ id }) => (
          <OrderDetail orderNumber={decodeURIComponent(id)} />
        ))}
      </Suspense>
    </div>
  );
}
