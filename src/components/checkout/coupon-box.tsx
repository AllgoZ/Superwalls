"use client";

import { useState, type FormEvent } from "react";
import { BadgeCheck, Loader2, TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/formatters";
import type { CouponPreview } from "@/lib/services/checkout";

/**
 * Coupon entry. The amount shown comes from the server; the code is checked again, with usage limits, at payment time.
 */
export function CouponBox({
  applied,
  onApply,
  onRemove,
  disabled,
}: {
  applied: CouponPreview | null;
  onApply: (code: string) => Promise<void>;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onApply(code.trim());
      setCode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That coupon can't be applied.");
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-success-soft px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 font-semibold text-success">
          <BadgeCheck className="size-4 shrink-0" aria-hidden />
          <span>
            {applied.code} applied · saves {formatINR(applied.discountPaise)}
          </span>
        </span>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onRemove} disabled={disabled} aria-label="Remove coupon">
          <X aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mb-4" noValidate>
      <label htmlFor="coupon-code" className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <TicketPercent className="size-4 text-brand-blue" aria-hidden /> Have a coupon?
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Enter code"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={24}
          className="h-10 text-sm"
          disabled={disabled || busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "coupon-error" : undefined}
        />
        <Button type="submit" variant="outline" className="h-10" disabled={disabled || busy || !code.trim()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Apply
        </Button>
      </div>
      {error ? (
        <p id="coupon-error" role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
