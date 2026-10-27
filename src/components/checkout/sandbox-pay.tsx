"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/formatters";

interface SessionInfo {
  amountPaise: number;
  orderNumber: string;
  status: string;
}

/**
 * Stand-in for a payment gateway's hosted page, for LOCAL TESTING ONLY. It moves no money. The buttons ask the
 * server to play the gateway: the server signs a webhook and verifies it exactly like a real provider's.
 */
export function SandboxPay({ providerOrderId }: { providerOrderId: string }) {
  const [info, setInfo] = useState<SessionInfo | "unavailable" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/payments/sandbox/session?o=${encodeURIComponent(providerOrderId)}`, { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as SessionInfo) : "unavailable"))
      .then(setInfo)
      .catch(() => setInfo("unavailable"));
  }, [providerOrderId]);

  async function complete(outcome: "paid" | "failed" | "cancelled") {
    if (info === null || info === "unavailable") return;
    setBusy(outcome);
    try {
      await fetch("/api/payments/sandbox/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerOrderId, outcome }),
      });
    } finally {
      router.push(`/checkout/return?order=${encodeURIComponent(info.orderNumber)}`);
    }
  }

  if (info === null) return <p className="text-center text-sm text-muted-foreground">Loading…</p>;
  if (info === "unavailable") {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This test payment page isn&apos;t available. The sandbox gateway is development-only.
      </p>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border-2 border-dashed border-brand-yellow bg-white p-6">
      <div className="flex items-center gap-2 text-sm font-bold tracking-wide text-[#7a5b00] uppercase">
        <FlaskConical className="size-4" aria-hidden />
        Test payment · no money moves
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Order {info.orderNumber}</p>
        <p className="text-3xl font-extrabold tabular-nums text-ink">{formatINR(info.amountPaise)}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button size="lg" disabled={busy !== null} onClick={() => complete("paid")}>
          {busy === "paid" ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Simulate successful payment
        </Button>
        <Button size="lg" variant="outline" disabled={busy !== null} onClick={() => complete("failed")}>
          Simulate failed payment
        </Button>
        <Button size="lg" variant="ghost" disabled={busy !== null} onClick={() => complete("cancelled")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
