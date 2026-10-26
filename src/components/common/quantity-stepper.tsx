"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Smallest value reachable with the minus button. Use 0 where reaching it removes the item. */
  min?: number;
  max: number;
  /** Product name, used to give the buttons unambiguous accessible names. */
  label: string;
  size?: "md" | "lg";
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  size = "md",
  className,
}: QuantityStepperProps) {
  const buttonClass = cn(
    "flex items-center justify-center rounded-lg text-brand-blue transition-colors hover:bg-brand-blue-soft disabled:pointer-events-none disabled:opacity-40",
    size === "lg" ? "size-11" : "size-9",
  );

  return (
    <div
      role="group"
      aria-label={`Quantity of ${label}`}
      className={cn(
        "inline-flex items-center rounded-xl border border-input bg-white p-0.5",
        className,
      )}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease quantity of ${label}`}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output
        aria-live="polite"
        className={cn(
          "min-w-8 text-center font-semibold text-ink tabular-nums",
          size === "lg" ? "text-base" : "text-sm",
        )}
      >
        {value}
      </output>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase quantity of ${label}`}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
