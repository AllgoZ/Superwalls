/** Admin date-time inputs are entered and shown in India time (the business's time zone), whatever the browser's. */
const IST = "+05:30";

/** "2026-11-01T10:30" (as typed, IST) -> "2026-11-01T10:30:00+05:30". Empty -> null. */
export function istInputToIso(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}${IST}` : null;
}

/** ISO instant -> "2026-11-01T10:30" in India time, for <input type="datetime-local">. */
export function isoToIstInput(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
