import "server-only";
import { param, type SearchParams } from "./list";

export const RANGE_KEYS = ["today", "yesterday", "7d", "30d", "this_month", "prev_month", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  this_month: "This month",
  prev_month: "Previous month",
  custom: "Custom",
};

export interface DateRange {
  key: RangeKey;
  /** Inclusive calendar dates (YYYY-MM-DD) in India time. */
  from: string;
  to: string;
  days: number;
  /** The equally long period immediately before, for comparison. */
  prevFrom: string;
  prevTo: string;
  label: string;
}

const DAY = 86_400_000;
const parse = (date: string) => Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => format(parse(date) + n * DAY);

export function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function monthBounds(date: string, offset: number): { from: string; to: string } {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + offset;
  const first = Date.UTC(year, month, 1);
  const last = Date.UTC(year, month + 1, 0);
  return { from: format(first), to: format(last) };
}

/** Turns `?range=…&from=…&to=…` into a validated, bounded range. Anything odd falls back to the last 30 days. */
export function resolveRange(searchParams: SearchParams): DateRange {
  const today = todayIst();
  const requested = param(searchParams, "range") as RangeKey | undefined;
  const key: RangeKey = requested && (RANGE_KEYS as readonly string[]).includes(requested) ? requested : "30d";

  let from = addDays(today, -29);
  let to = today;
  switch (key) {
    case "today":
      from = to = today;
      break;
    case "yesterday":
      from = to = addDays(today, -1);
      break;
    case "7d":
      from = addDays(today, -6);
      break;
    case "this_month":
      ({ from, to } = monthBounds(today, 0));
      if (to > today) to = today;
      break;
    case "prev_month":
      ({ from, to } = monthBounds(today, -1));
      break;
    case "custom": {
      const f = param(searchParams, "from");
      const t = param(searchParams, "to");
      const valid = (value?: string): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
      if (valid(f) && valid(t) && f <= t) {
        from = f;
        // Bounded so a typo can't ask the database for decades of daily rows.
        to = parse(t) - parse(f) > 366 * DAY ? addDays(f, 366) : t;
      }
      break;
    }
  }

  const days = Math.round((parse(to) - parse(from)) / DAY) + 1;
  return { key, from, to, days, prevFrom: addDays(from, -days), prevTo: addDays(from, -1), label: RANGE_LABEL[key] };
}
