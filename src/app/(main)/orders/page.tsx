import type { Metadata } from "next";
import { OrdersList } from "@/components/orders/orders-list";

export const metadata: Metadata = { title: "My Orders" };

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="mb-1 text-2xl font-extrabold text-ink">My Orders</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Orders marked Demo are sample or test orders stored on this device only.
      </p>
      <OrdersList />
    </div>
  );
}
