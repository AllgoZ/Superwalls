"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { SECTION_META, sectionSchema } from "@/lib/admin/schemas/content";
import type { AdminSection } from "@/lib/server/admin/queries/content";
import { useCan } from "./admin-provider";
import { AdminBadge } from "./admin-badge";
import { useAdminAction } from "./use-admin-action";

interface Draft {
  key: AdminSection["key"];
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  items: { title: string; text: string }[];
  isVisible: boolean;
  sortOrder: string;
}

export function SectionsManager({ sections }: { sections: AdminSection[] }) {
  const canWrite = useCan("content.write");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();
  const meta = draft ? SECTION_META[draft.key] : null;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    if (!draft) return;
    const parsed = sectionSchema.safeParse({ ...draft, sortOrder: Number(draft.sortOrder) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setError(null);
    const ok = await run(() => adminCall("sections.save", parsed.data), { success: "Section saved" });
    if (ok) setDraft(null);
  }

  async function toggle(section: AdminSection, isVisible: boolean) {
    await run(() => adminCall("sections.save", { ...section, isVisible }), { success: isVisible ? "Section shown" : "Section hidden" });
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Turn sections on or off and set their order. Lower numbers appear first, below the products.</p>
      <ul className="divide-y rounded-xl border bg-white shadow-xs">
        {sections.map((section) => {
          const info = SECTION_META[section.key];
          return (
            <li key={section.key} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{info.label}</p>
                <p className="text-xs text-muted-foreground">{info.description}</p>
                {section.title ? <p className="mt-1 truncate text-sm text-ink">&ldquo;{section.title}&rdquo;</p> : null}
              </div>
              <AdminBadge tone="neutral">Order {section.sortOrder}</AdminBadge>
              {canWrite ? (
                <>
                  <Switch checked={section.isVisible} disabled={busy} onCheckedChange={(checked) => toggle(section, checked)} aria-label={`Show ${info.label}`} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setError(null);
                      setDraft({ ...section, sortOrder: String(section.sortOrder) });
                    }}
                  >
                    <Pencil aria-hidden /> Edit
                  </Button>
                </>
              ) : (
                <AdminBadge tone={section.isVisible ? "success" : "neutral"}>{section.isVisible ? "Shown" : "Hidden"}</AdminBadge>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog open={draft !== null} onOpenChange={(next) => !next && !busy && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit {meta?.label.toLowerCase()}</DialogTitle>
            <DialogDescription>{meta?.description}</DialogDescription>
          </DialogHeader>
          {draft && meta ? (
            <div className="space-y-4">
              {meta.fields.includes("title") ? (
                <div className="space-y-1.5">
                  <Label htmlFor="sc-title" className="text-xs font-semibold">{draft.key === "hero" ? "Headline" : "Title"}</Label>
                  <Input id="sc-title" value={draft.title} onChange={(event) => set("title", event.target.value)} maxLength={120} className="h-10 text-sm" />
                </div>
              ) : null}
              {meta.fields.includes("body") ? (
                <div className="space-y-1.5">
                  <Label htmlFor="sc-body" className="text-xs font-semibold">{draft.key === "hero" ? "Subtitle" : "Text"}</Label>
                  <Textarea id="sc-body" value={draft.body} onChange={(event) => set("body", event.target.value)} rows={4} maxLength={1000} className="text-sm" />
                  {draft.key === "brand_intro" ? <p className="text-xs text-muted-foreground">Leave a blank line between paragraphs.</p> : null}
                </div>
              ) : null}
              {meta.fields.includes("cta") ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-cta" className="text-xs font-semibold">Button label</Label>
                    <Input id="sc-cta" value={draft.ctaLabel} onChange={(event) => set("ctaLabel", event.target.value)} maxLength={40} className="h-10 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-href" className="text-xs font-semibold">Button link</Label>
                    <Input id="sc-href" value={draft.ctaHref} onChange={(event) => set("ctaHref", event.target.value)} placeholder="/help" className="h-10 text-sm" />
                  </div>
                </div>
              ) : null}
              {meta.fields.includes("items") ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Points</Label>
                  {draft.items.map((item, index) => (
                    <div key={index} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1.4fr_auto]">
                      <Input aria-label={`Point ${index + 1} heading`} value={item.title} onChange={(event) => set("items", draft.items.map((it, i) => (i === index ? { ...it, title: event.target.value } : it)))} placeholder="Heading" maxLength={80} className="h-9 text-sm" />
                      <Input aria-label={`Point ${index + 1} text`} value={item.text} onChange={(event) => set("items", draft.items.map((it, i) => (i === index ? { ...it, text: event.target.value } : it)))} placeholder="Short text" maxLength={200} className="h-9 text-sm" />
                      <Button type="button" variant="ghost" size="icon-sm" className="text-danger" aria-label={`Remove point ${index + 1}`} onClick={() => set("items", draft.items.filter((_, i) => i !== index))}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  ))}
                  {draft.items.length < 8 ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => set("items", [...draft.items, { title: "", text: "" }])}>
                      <Plus aria-hidden /> Add point
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sc-order" className="text-xs font-semibold">Display order</Label>
                  <Input id="sc-order" inputMode="numeric" value={draft.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} className="h-10 w-28 text-sm" />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm font-semibold">
                  Shown <Switch checked={draft.isVisible} onCheckedChange={(checked) => set("isVisible", checked)} aria-label="Shown" />
                </label>
              </div>
              {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save section"}</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
