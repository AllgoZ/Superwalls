import { formatDateTime } from "@/lib/formatters/date";
import type { TimelineEntry } from "@/lib/server/admin/queries/orders";
import { cn } from "@/lib/utils";

const DOT: Record<TimelineEntry["tone"], string> = {
  neutral: "bg-muted-foreground/40",
  info: "bg-primary",
  success: "bg-success",
  danger: "bg-danger",
};

/** Vertical history. Every entry comes from a real database record (order row, payment attempt, status event). */
export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="relative">
          <span className={cn("absolute top-1.5 -left-[1.62rem] size-2.5 rounded-full ring-4 ring-white", DOT[entry.tone])} aria-hidden />
          <p className="text-sm font-semibold text-ink">{entry.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(entry.at)}
            {entry.actor ? ` · ${entry.actor}` : ""}
          </p>
          {entry.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
