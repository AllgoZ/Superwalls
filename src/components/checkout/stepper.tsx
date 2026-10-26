import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const CHECKOUT_STEPS = [
  { id: "delivery", label: "Delivery" },
  { id: "review", label: "Review & Pay" },
  { id: "confirmation", label: "Confirmation" },
] as const;

export type CheckoutStepId = (typeof CHECKOUT_STEPS)[number]["id"];

export function CheckoutStepper({ current }: { current: CheckoutStepId }) {
  const currentIndex = CHECKOUT_STEPS.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-start">
        {CHECKOUT_STEPS.map((step, index) => {
          const done = index < currentIndex || current === "confirmation";
          const active = index === currentIndex;
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className={cn("flex flex-1 flex-col items-center gap-1.5", index > 0 && "relative")}
            >
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2",
                    index <= currentIndex ? "bg-brand-blue" : "bg-border",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                  done && "border-brand-blue bg-brand-blue text-white",
                  active && !done && "border-brand-blue bg-white text-brand-blue",
                  !done && !active && "border-border bg-white text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-center text-xs font-semibold",
                  active || done ? "text-ink" : "text-muted-foreground",
                )}
              >
                {step.label}
                <span className="sr-only">
                  {done ? " (completed)" : active ? " (current step)" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
