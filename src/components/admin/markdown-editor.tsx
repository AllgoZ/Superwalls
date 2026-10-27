"use client";

import { useRef, useState } from "react";
import { Bold, Heading2, Italic, Link2, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/common/markdown";
import { cn } from "@/lib/utils";

type ToolAction = "heading" | "bold" | "italic" | "bullets" | "numbers" | "link";

const TOOLS: { label: string; icon: typeof Bold; action: ToolAction }[] = [
  { label: "Heading", icon: Heading2, action: "heading" },
  { label: "Bold", icon: Bold, action: "bold" },
  { label: "Italic", icon: Italic, action: "italic" },
  { label: "Bulleted list", icon: List, action: "bullets" },
  { label: "Numbered list", icon: ListOrdered, action: "numbers" },
  { label: "Link", icon: Link2, action: "link" },
];

/**
 * A controlled Markdown editor. There is deliberately no rich-text HTML: the stored value is plain Markdown, and the
 * preview (like the storefront) renders it with raw HTML disabled, so a page can never carry a script.
 */
export function MarkdownEditor({ value, onChange, disabled, id }: { value: string; onChange: (value: string) => void; disabled?: boolean; id?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");

  function wrap(before: string, after = before, placeholder = "text") {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = value.slice(start, end) || placeholder;
    onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function linePrefix(prefix: string) {
    const el = ref.current;
    if (!el) return;
    const start = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    onChange(`${value.slice(0, start)}${prefix}${value.slice(start)}`);
    requestAnimationFrame(() => el.focus());
  }

  function apply(action: ToolAction) {
    switch (action) {
      case "heading":
        return linePrefix("## ");
      case "bold":
        return wrap("**");
      case "italic":
        return wrap("*");
      case "bullets":
        return linePrefix("- ");
      case "numbers":
        return linePrefix("1. ");
      case "link":
        return wrap("[", "](https://)", "link text");
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-2 py-1.5">
        <div className="flex gap-0.5" role="toolbar" aria-label="Formatting">
          {TOOLS.map(({ label, icon: Icon, action }) => (
            <Button key={label} type="button" variant="ghost" size="icon-sm" onClick={() => apply(action)} disabled={disabled || tab === "preview"} aria-label={label} title={label}>
              <Icon aria-hidden />
            </Button>
          ))}
        </div>
        <div className="flex gap-1 rounded-md bg-muted p-0.5" role="tablist" aria-label="Editor mode">
          {(["write", "preview"] as const).map((mode) => (
            <button key={mode} type="button" role="tab" aria-selected={tab === mode} onClick={() => setTab(mode)} className={cn("rounded px-2.5 py-1 text-xs font-semibold capitalize", tab === mode ? "bg-white text-primary shadow-xs" : "text-muted-foreground")}>
              {mode}
            </button>
          ))}
        </div>
      </div>
      {tab === "write" ? (
        <Textarea ref={ref} id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} rows={18} className="min-h-72 rounded-none border-0 font-mono text-sm focus-visible:ring-0" placeholder="Write the page in Markdown. Use ## for headings and - for lists." />
      ) : (
        <div className="min-h-72 p-4">{value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>}</div>
      )}
    </div>
  );
}
