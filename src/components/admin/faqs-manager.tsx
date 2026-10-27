"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { faqSchema } from "@/lib/admin/schemas/content";
import type { AdminFaq } from "@/lib/server/admin/queries/content";
import { useCan } from "./admin-provider";
import { AdminBadge } from "./admin-badge";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyRows, TableCard, TableScroll } from "./table-card";
import { useAdminAction } from "./use-admin-action";

interface Draft {
  id?: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: string;
  isActive: boolean;
}

export function FaqsManager({ faqs }: { faqs: AdminFaq[] }) {
  const canWrite = useCan("content.write");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AdminFaq | null>(null);
  const { run, busy, router } = useAdminAction();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));
  const categories = [...new Set(faqs.map((faq) => faq.category))];

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const parsed = faqSchema.safeParse({ ...draft, sortOrder: Number(draft.sortOrder) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setError(null);
    const ok = await run(() => adminCall("faqs.save", parsed.data), { success: draft.id ? "FAQ saved" : "FAQ created" });
    if (ok) setDraft(null);
  }

  return (
    <>
      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => { setDraft({ category: categories[0] ?? "General", question: "", answer: "", sortOrder: String((faqs.at(-1)?.sortOrder ?? 0) + 10), isActive: true }); setError(null); }}>
            <Plus aria-hidden /> New FAQ
          </Button>
        </div>
      ) : null}
      <TableCard>
        {faqs.length === 0 ? (
          <EmptyRows title="No FAQs yet" description="Add the questions customers ask most. They appear on the Help page." />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faqs.map((faq) => (
                  <TableRow key={faq.id}>
                    <TableCell className="max-w-md">
                      <p className="font-semibold text-ink">{faq.question}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{faq.answer}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{faq.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{faq.sortOrder}</TableCell>
                    <TableCell><AdminBadge tone={faq.isActive ? "success" : "neutral"}>{faq.isActive ? "Shown" : "Hidden"}</AdminBadge></TableCell>
                    <TableCell>
                      {canWrite ? (
                        <div className="flex justify-end gap-0.5">
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit "${faq.question}"`} onClick={() => { setDraft({ ...faq, sortOrder: String(faq.sortOrder) }); setError(null); }}><Pencil aria-hidden /></Button>
                          <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`Delete "${faq.question}"`} onClick={() => setRemoving(faq)}><Trash2 aria-hidden /></Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </TableCard>

      <Dialog open={draft !== null} onOpenChange={(next) => !next && !busy && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit FAQ" : "New FAQ"}</DialogTitle>
            <DialogDescription>Shown on the Help page, grouped by category.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <form onSubmit={save} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="faq-q" className="text-xs font-semibold">Question</Label>
                <Input id="faq-q" value={draft.question} onChange={(event) => set("question", event.target.value)} maxLength={200} className="h-10 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="faq-a" className="text-xs font-semibold">Answer</Label>
                <Textarea id="faq-a" value={draft.answer} onChange={(event) => set("answer", event.target.value)} rows={5} maxLength={2000} className="text-sm" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="faq-c" className="text-xs font-semibold">Category</Label>
                  <Input id="faq-c" value={draft.category} onChange={(event) => set("category", event.target.value)} maxLength={40} list="faq-categories" className="h-10 text-sm" />
                  <datalist id="faq-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="faq-o" className="text-xs font-semibold">Display order</Label>
                  <Input id="faq-o" inputMode="numeric" value={draft.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} className="h-10 text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <Switch checked={draft.isActive} onCheckedChange={(checked) => set("isActive", checked)} aria-label="Shown on the Help page" /> Shown on the Help page
              </label>
              {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
                <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save FAQ"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        destructive
        title="Delete this FAQ?"
        description={removing?.question}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!removing) return;
          await adminCall("faqs.delete", { id: removing.id });
          router.refresh();
        }}
      />
    </>
  );
}
