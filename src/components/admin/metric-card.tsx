import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Percent change from `previous` to `current`, or null when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function MetricCard({
  label,
  value,
  hint,
  delta,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Percent change versus the previous period; null renders "no earlier data". */
  delta?: number | null;
  tone?: "default" | "warning" | "danger";
  icon?: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-xs", tone === "danger" && "border-danger/30", tone === "warning" && "border-brand-yellow/60")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className={cn("mt-1.5 text-2xl font-extrabold tracking-tight text-ink tabular-nums", tone === "danger" && "text-danger")}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        {delta !== undefined ? (
          delta === null ? (
            <span>No earlier data to compare</span>
          ) : (
            <span className={cn("inline-flex items-center gap-0.5 font-semibold", delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted-foreground")}>
              {delta > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : delta < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
              {Math.abs(delta)}% <span className="sr-only">{delta >= 0 ? "up" : "down"}</span>
              <span className="font-normal text-muted-foreground"> vs previous period</span>
            </span>
          )
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}
