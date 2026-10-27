import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "progress" | "success" | "danger" | "warning";

const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-brand-blue-soft text-primary",
  progress: "bg-brand-yellow-soft text-[#7a5b00]",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-brand-yellow-soft text-[#7a5b00]",
};

export function AdminBadge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONE[tone], className)}>
      {children}
    </span>
  );
}

export const PRODUCT_STATUS_BADGE = {
  published: { label: "Published", tone: "success" },
  unpublished: { label: "Unpublished", tone: "neutral" },
  archived: { label: "Archived", tone: "warning" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

export const STOCK_BADGE = {
  in_stock: { label: "In stock", tone: "success" },
  low_stock: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
