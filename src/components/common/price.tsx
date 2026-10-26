import { getDiscountPercent } from "@/lib/commerce/pricing";
import { formatINR } from "@/lib/formatters";
import type { Paise } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PriceProps {
  pricePaise: Paise;
  compareAtPricePaise?: Paise;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS = { sm: "text-base", md: "text-lg", lg: "text-2xl" } as const;

export function Price({ pricePaise, compareAtPricePaise, size = "md", className }: PriceProps) {
  const percent = getDiscountPercent({ pricePaise, compareAtPricePaise });
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-bold text-ink", SIZE_CLASS[size])}>{formatINR(pricePaise)}</span>
      {compareAtPricePaise && percent > 0 ? (
        <>
          <span className="text-sm text-muted-foreground line-through">
            <span className="sr-only">Original price </span>
            {formatINR(compareAtPricePaise)}
          </span>
          <span className="text-xs font-semibold text-success">{percent}% off</span>
        </>
      ) : null}
    </p>
  );
}
