"use client";

import Link from "next/link";
import { PackageOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { useServiceQuery } from "@/lib/hooks/use-service-query";
import { getOrders } from "@/lib/services/orders";
import { OrderCard } from "./order-card";

export function OrdersList() {
  const orders = useServiceQuery(getOrders);

  if (orders.status === "loading") return <ListSkeleton rows={3} rowClassName="h-44" />;
  if (orders.status === "error") return <ErrorState onRetry={orders.reload} />;

  if (!orders.data || orders.data.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen />}
        title="No orders yet"
        description="When you place an order, it will show up here so you can follow its progress."
        action={
          <Link href="/#products" className={buttonVariants({ size: "lg" })}>
            Start Shopping
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2" aria-label="Your orders">
      {orders.data.map((order) => (
        <li key={order.id}>
          <OrderCard order={order} />
        </li>
      ))}
    </ul>
  );
}
