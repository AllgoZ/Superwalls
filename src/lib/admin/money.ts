/**
 * Exact rupee <-> paise conversion for admin forms. Strings are parsed digit by digit, never through
 * floating point, so "199.10" is always 19910 paise.
 */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, "");
  const match = cleaned.match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0") || "0");
  return whole * 100 + fraction;
}

/** 19910 -> "199.10". For prefilling inputs. */
export function paiseToRupeesInput(paise: number): string {
  const whole = Math.trunc(paise / 100);
  const fraction = String(paise % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
}
