"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleSelect, type SelectOption } from "./simple-select";

export interface FilterDef {
  key: string;
  label: string;
  options: SelectOption[];
  /** The value meaning "no filter" (removed from the URL). Defaults to "all". */
  neutral?: string;
}

export interface DateFilterDef {
  key: string;
  label: string;
}

/** Search box + dropdowns (+ optional dates) that live in the URL, so every filtered view is linkable and server-rendered. */
export function FilterBar({
  searchPlaceholder = "Search",
  filters = [],
  dates = [],
}: {
  searchPlaceholder?: string;
  filters?: FilterDef[];
  dates?: DateFilterDef[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [text, setText] = useState(current.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function push(next: URLSearchParams) {
    next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(current.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  function onSearch(value: string) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam("q", value.trim() || null), 350);
  }

  const active = [...current.keys()].some((key) => key !== "page" && key !== "sort");

  return (
    <div className="flex flex-wrap items-end gap-2 border-b p-3 print:hidden">
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={text} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="h-9 pl-8 text-sm" />
      </div>
      {filters.map((filter) => {
        const neutral = filter.neutral ?? "all";
        return (
          <SimpleSelect
            key={filter.key}
            aria-label={filter.label}
            className="w-auto min-w-36"
            value={current.get(filter.key) ?? neutral}
            onValueChange={(value) => setParam(filter.key, value === neutral ? null : value)}
            options={filter.options}
          />
        );
      })}
      {dates.map((date) => (
        <label key={date.key} className="flex flex-col text-[0.7rem] font-semibold text-muted-foreground">
          {date.label}
          <Input type="date" value={current.get(date.key) ?? ""} onChange={(event) => setParam(date.key, event.target.value || null)} className="h-9 w-36 text-sm" />
        </label>
      ))}
      {active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setText("");
            router.replace(pathname);
          }}
        >
          <X aria-hidden /> Clear
        </Button>
      ) : null}
    </div>
  );
}
