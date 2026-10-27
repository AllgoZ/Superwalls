"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESETS: { key: string; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "prev_month", label: "Previous month" },
  { key: "custom", label: "Custom" },
];

/** Date-range control for dashboards and reports. The range lives in the URL (`?range=…&from=…&to=…`). */
export function RangeSelector({ active, from, to }: { active: string; from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);
  const [showCustom, setShowCustom] = useState(active === "custom");

  function go(range: string, extra?: { from: string; to: string }) {
    const next = new URLSearchParams(current.toString());
    next.set("range", range);
    if (extra) {
      next.set("from", extra.from);
      next.set("to", extra.to);
    } else {
      next.delete("from");
      next.delete("to");
    }
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Date range">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            aria-pressed={active === preset.key}
            onClick={() => (preset.key === "custom" ? setShowCustom(true) : (setShowCustom(false), go(preset.key)))}
            className={cn("rounded-md px-2.5 py-1 text-xs font-semibold transition-colors", active === preset.key || (preset.key === "custom" && showCustom) ? "bg-white text-primary shadow-xs" : "text-muted-foreground hover:text-ink")}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {showCustom ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (customFrom && customTo && customFrom <= customTo) go("custom", { from: customFrom, to: customTo });
          }}
        >
          <Input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} className="h-8 w-36 text-xs" aria-label="From date" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} className="h-8 w-36 text-xs" aria-label="To date" />
          <Button type="submit" size="sm" disabled={!customFrom || !customTo || customFrom > customTo}>Apply</Button>
        </form>
      ) : null}
    </div>
  );
}
