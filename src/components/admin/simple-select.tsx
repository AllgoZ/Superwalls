"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/** A labelled single-choice dropdown. Values must be non-empty strings (use e.g. "all" for "no filter"). */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  id,
  disabled,
  ...aria
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(String(next))} items={options} disabled={disabled}>
      <SelectTrigger id={id} className={cn("h-9 w-full min-w-32", className)} aria-label={aria["aria-label"]}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
