"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface AutoRedirectNoticeProps {
  href: string;
  label: string;
  seconds: number;
}

/** Counts down, then navigates. Always cancellable, and announced politely to screen readers. */
export function AutoRedirectNotice({ href, label, seconds }: AutoRedirectNoticeProps) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(seconds);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (cancelled) return;
    const timer = setInterval(() => setRemaining((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, [cancelled]);

  useEffect(() => {
    if (!cancelled && remaining <= 0) router.push(href);
  }, [cancelled, remaining, href, router]);

  if (cancelled) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 rounded-2xl bg-brand-blue-soft px-4 py-3"
    >
      <p className="text-sm font-medium text-brand-blue">
        Taking you to {label} in {Math.max(remaining, 0)}s…
      </p>
      <Button variant="ghost" size="sm" onClick={() => setCancelled(true)} className="text-brand-blue">
        Stay here
      </Button>
    </div>
  );
}
