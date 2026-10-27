import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AddressBlock } from "@/components/common/address-block";
import { PaymentStatusBadge } from "@/components/common/status-badge";
import { WhatsAppLink } from "@/components/common/whatsapp-link";
import { OrderSummary } from "@/components/cart/order-summary";
import { formatINR } from "@/lib/formatters";
import { PAYMENT_METHOD_LABEL } from "@/lib/orders/status";
import type { Order } from "@/lib/types";
import { AutoRedirectNotice } from "./auto-redirect-notice";
import { GuestAccountPrompt } from "./guest-account-prompt";

/** Step 3. Only ever rendered for an order whose payment the server has verified as paid. */
export function ConfirmationStep({ order }: { order: Order }) {
  const isGuest = order.customerType === "guest";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex flex-col items-center text-center" role="status">
        <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-9" aria-hidden />
        </div>
        <h2 className="text-2xl font-extrabold text-ink">Payment received. Order placed!</h2>
        <p className="mt-1 text-sm text-muted-foreground">Thank you for shopping with SuperWalls.</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-soft px-4 py-2 text-sm font-bold text-ink">
          {order.orderNumber}
        </p>
      </div>

      {isGuest ? <GuestAccountPrompt order={order} /> : <AutoRedirectNotice href="/orders" label="My Orders" seconds={6} />}

      <section aria-labelledby="conf-items" className="rounded-2xl border bg-white p-4">
        <h3 id="conf-items" className="mb-3 text-base font-bold text-ink">
          Order summary
        </h3>
        <ul className="mb-4 space-y-2">
          {order.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3 text-sm">
              <span className="text-ink">
                {item.name} <span className="text-muted-foreground">× {item.quantity}</span>
              </span>
              <span className="font-semibold tabular-nums text-ink">{formatINR(item.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        <OrderSummary totals={order} className="border-t pt-4" />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="conf-address" className="rounded-2xl border bg-white p-4">
          <h3 id="conf-address" className="mb-2 text-base font-bold text-ink">
            Delivering to
          </h3>
          <AddressBlock address={order.address} />
        </section>
        <section aria-labelledby="conf-payment" className="rounded-2xl border bg-white p-4">
          <h3 id="conf-payment" className="mb-2 text-base font-bold text-ink">
            Payment
          </h3>
          <p className="mb-2 text-sm text-ink">{PAYMENT_METHOD_LABEL}</p>
          <PaymentStatusBadge status={order.paymentStatus} />
        </section>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={isGuest ? `/track?o=${encodeURIComponent(order.orderNumber)}` : `/orders/${encodeURIComponent(order.orderNumber)}`}
          className={`${buttonVariants({ size: "lg" })} flex-1`}
        >
          Track this order
        </Link>
        <Link href="/" className={`${buttonVariants({ size: "lg", variant: "outline" })} flex-1`}>
          Continue Shopping
        </Link>
      </div>
      <div className="flex justify-center">
        <WhatsAppLink orderNumber={order.orderNumber} label="Need help? Chat on WhatsApp" />
      </div>
    </div>
  );
}
