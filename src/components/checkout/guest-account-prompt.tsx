"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { getGuestToken } from "@/lib/checkout/local-state";
import type { Order } from "@/lib/types";

/**
 * Shown after a guest order. Offers (never forces) an account, and a private tracking link.
 * Creating an account later attaches this order only after the customer proves ownership
 * (the secret tracking code on this device, or an email address Supabase has verified).
 */
export function GuestAccountPrompt({ order }: { order: Order }) {
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = getGuestToken(order.orderNumber);
    // The token goes in the URL fragment, which browsers never send to servers or put in Referer headers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) setLink(`${window.location.origin}/track?o=${encodeURIComponent(order.orderNumber)}#t=${token}`);
  }, [order.orderNumber]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  return (
    <section aria-labelledby="guest-prompt" className="space-y-3 rounded-2xl bg-brand-blue-soft p-4">
      <h3 id="guest-prompt" className="text-base font-bold text-ink">
        Keep track of this order
      </h3>
      <p className="text-sm text-ink">
        You checked out as a guest. This device remembers the order, and you can save your private tracking link
        to follow it from anywhere. Anyone with the link can see this order, so keep it to yourself.
      </p>
      {link ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            aria-label="Private tracking link"
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-xs text-ink"
          />
          <Button variant="outline" onClick={copy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/signup?next=${encodeURIComponent("/orders")}`} className={`${buttonVariants({ variant: "accent" })} flex-1`}>
          <UserPlus aria-hidden />
          Create an account (optional)
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        With an account you get order history and saved addresses. We add this order to it once you&apos;ve verified
        your email.
      </p>
    </section>
  );
}
