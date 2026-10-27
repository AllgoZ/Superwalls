import { formatINR } from "@/lib/formatters/money";

/** "10% off (max ₹50)" or "₹100 off". Plain module so server pages and client components can both use it. */
export function describeValue(p: { discountType: "percent" | "fixed"; percentOff: number | null; fixedOffPaise: number | null; maxDiscountPaise: number | null }): string {
  return p.discountType === "percent"
    ? `${p.percentOff}% off${p.maxDiscountPaise ? ` (max ${formatINR(p.maxDiscountPaise)})` : ""}`
    : `${formatINR(p.fixedOffPaise ?? 0)} off`;
}
