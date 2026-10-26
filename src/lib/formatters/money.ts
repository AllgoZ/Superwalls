import type { Paise } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Formats integer paise as INR, e.g. 149900 -> "₹1,499". Paise show only when non-zero. */
export function formatINR(paise: Paise): string {
  return inr.format(paise / 100);
}

/** Converts a rupee amount (possibly fractional) to integer paise. */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}
