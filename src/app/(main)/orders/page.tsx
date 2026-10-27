import type { Metadata } from "next";
import Link from "next/link";
import { OrdersList } from "@/components/orders/orders-list";

export const metadata: Metadata = { title: "My Orders" };

export default function OrdersPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 md:pt-8">
      <h1 className="mb-1 text-2xl font-extrabold text-ink">My Orders</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Orders you placed while signed in, plus guest orders remembered on this device.{" "}
        <Link href="/track" className="font-semibold text-brand-blue underline">
          Track an order
        </Link>
      </p>
      <OrdersList />
    </div>
  );
}
