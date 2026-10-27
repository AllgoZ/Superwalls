"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { Eye, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { isoToIstInput, istInputToIso } from "@/lib/admin/datetime";
import { paiseToRupeesInput, parseRupees } from "@/lib/admin/money";
import { describeValue } from "@/lib/admin/promotion-format";
import { promotionSchema } from "@/lib/admin/schemas/promotions";
import { formatDateTime } from "@/lib/formatters/date";
import { formatINR } from "@/lib/formatters/money";
import type { AdminPromotion, PromotionState } from "@/lib/server/admin/queries/promotions";
import { useCan } from "./admin-provider";
import { AdminBadge, type Tone } from "./admin-badge";
import { ConfirmDialog } from "./confirm-dialog";
import { SimpleSelect } from "./simple-select";
import { EmptyRows, TableCard, TableScroll } from "./table-card";
import { useAdminAction } from "./use-admin-action";

const STATE: Record<PromotionState, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "neutral" },
  exhausted: { label: "Used up", tone: "warning" },
  inactive: { label: "Inactive", tone: "neutral" },
};

interface Draft {
  id?: string;
  code: string;
  description: string;
  type: "percent" | "fixed";
  percent: string;
  fixed: string;
  minOrder: string;
  maxDiscount: string;
  startsAt: string;
  expiresAt: string;
  maxUses: string;
  maxPerCustomer: string;
  isActive: boolean;
}

const BLANK: Draft = { code: "", description: "", type: "percent", percent: "10", fixed: "", minOrder: "", maxDiscount: "", startsAt: "", expiresAt: "", maxUses: "", maxPerCustomer: "1", isActive: true };

const toDraft = (p: AdminPromotion): Draft => ({
  id: p.id,
  code: p.code,
  description: p.description,
  type: p.discountType,
  percent: p.percentOff === null ? "" : String(p.percentOff),
  fixed: p.fixedOffPaise === null ? "" : paiseToRupeesInput(p.fixedOffPaise),
  minOrder: p.minOrderPaise > 0 ? paiseToRupeesInput(p.minOrderPaise) : "",
  maxDiscount: p.maxDiscountPaise === null ? "" : paiseToRupeesInput(p.maxDiscountPaise),
  startsAt: isoToIstInput(p.startsAt),
  expiresAt: isoToIstInput(p.expiresAt),
  maxUses: p.maxUses === null ? "" : String(p.maxUses),
  maxPerCustomer: p.maxUsesPerCustomer === null ? "" : String(p.maxUsesPerCustomer),
  isActive: p.isActive,
});

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PromotionsManager({ promotions }: { promotions: AdminPromotion[] }) {
  const canWrite = useCan("promotions.write");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AdminPromotion | null>(null);
  const { run, busy, router } = useAdminAction();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const money = (text: string) => (text.trim() ? parseRupees(text) : null);
    const whole = (text: string) => (text.trim() ? Number(text) : null);
    const minOrder = money(draft.minOrder);
    const fixed = draft.type === "fixed" ? money(draft.fixed) : null;
    const maxDiscount = draft.type === "percent" ? money(draft.maxDiscount) : null;
    if ((draft.type === "fixed" && draft.fixed.trim() && fixed === null) || (draft.minOrder.trim() && minOrder === null) || (draft.type === "percent" && draft.maxDiscount.trim() && maxDiscount === null)) {
      setError("Enter amounts in rupees, like 100 or 99.50.");
      return;
    }
    const parsed = promotionSchema.safeParse({
      id: draft.id,
      code: draft.code,
      description: draft.description,
      discountType: draft.type,
      percentOff: draft.type === "percent" ? whole(draft.percent) : null,
      fixedOffPaise: fixed,
      minOrderPaise: minOrder ?? 0,
      maxDiscountPaise: maxDiscount,
      startsAt: istInputToIso(draft.startsAt),
      expiresAt: istInputToIso(draft.expiresAt),
      maxUses: whole(draft.maxUses),
      maxUsesPerCustomer: whole(draft.maxPerCustomer),
      isActive: draft.isActive,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setError(null);
    const ok = await run(() => adminCall("promotions.save", parsed.data), { success: draft.id ? "Coupon saved" : "Coupon created" });
    if (ok) setDraft(null);
  }

  return (
    <>
      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <Button size="sm" onClick={() => { setDraft(BLANK); setError(null); }}>
            <Plus aria-hidden /> New coupon
          </Button>
        </div>
      ) : null}

      <TableCard>
        {promotions.length === 0 ? (
          <EmptyRows title="No coupons yet" description="Create a code customers can enter at checkout. The server checks every code, date and usage limit." />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="text-right">Min order</TableHead>
                  <TableHead>Valid</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Given</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => {
                  const state = STATE[promo.state];
                  return (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <Link href={`/admin/promotions/${promo.id}`} className="font-mono text-sm font-bold text-primary hover:underline">{promo.code}</Link>
                        {promo.description ? <span className="block max-w-56 truncate text-xs text-muted-foreground">{promo.description}</span> : null}
                      </TableCell>
                      <TableCell className="font-medium">{describeValue(promo)}</TableCell>
                      <TableCell className="text-right tabular-nums">{promo.minOrderPaise > 0 ? formatINR(promo.minOrderPaise) : "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {promo.startsAt ? `From ${formatDateTime(promo.startsAt)}` : "Anytime"}
                        <br />
                        {promo.expiresAt ? `Until ${formatDateTime(promo.expiresAt)}` : "No expiry"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{promo.uses}{promo.maxUses ? ` / ${promo.maxUses}` : ""}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(promo.discountGivenPaise)}</TableCell>
                      <TableCell><AdminBadge tone={state.tone}>{state.label}</AdminBadge></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <Link href={`/admin/promotions/${promo.id}`} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted" aria-label={`Usage of ${promo.code}`}><Eye className="size-4" aria-hidden /></Link>
                          {canWrite ? (
                            <>
                              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${promo.code}`} onClick={() => { setDraft(toDraft(promo)); setError(null); }}><Pencil aria-hidden /></Button>
                              <Button variant="ghost" size="icon-sm" aria-label={promo.isActive ? `Deactivate ${promo.code}` : `Activate ${promo.code}`} disabled={busy} onClick={() => run(() => adminCall("promotions.setActive", { id: promo.id, active: !promo.isActive }), { success: promo.isActive ? "Deactivated" : "Activated" })}>
                                <Power className={promo.isActive ? "text-success" : "text-muted-foreground"} aria-hidden />
                              </Button>
                              {promo.uses === 0 ? <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`Delete ${promo.code}`} onClick={() => setRemoving(promo)}><Trash2 aria-hidden /></Button> : null}
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </TableCard>

      <Dialog open={draft !== null} onOpenChange={(next) => !next && !busy && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit coupon" : "New coupon"}</DialogTitle>
            <DialogDescription>Customers type the code at checkout. Dates are in India time. The server enforces everything below.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Field label="Code" htmlFor="pc-code" hint="Letters, numbers, - and _ (saved in capitals).">
                <Input id="pc-code" value={draft.code} onChange={(event) => set("code", event.target.value.toUpperCase())} className="h-10 font-mono text-sm" maxLength={24} />
              </Field>
              <Field label="Discount type" htmlFor="pc-type">
                <SimpleSelect id="pc-type" value={draft.type} onValueChange={(value) => set("type", value as "percent" | "fixed")} options={[{ value: "percent", label: "Percentage off" }, { value: "fixed", label: "Fixed amount off" }]} className="h-10" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description (internal)" htmlFor="pc-desc">
                  <Textarea id="pc-desc" value={draft.description} onChange={(event) => set("description", event.target.value)} rows={2} maxLength={300} className="text-sm" />
                </Field>
              </div>
              {draft.type === "percent" ? (
                <>
                  <Field label="Percent off" htmlFor="pc-percent"><Input id="pc-percent" inputMode="numeric" value={draft.percent} onChange={(event) => set("percent", event.target.value)} className="h-10 text-sm" /></Field>
                  <Field label="Maximum discount (₹)" htmlFor="pc-max" hint="Optional cap."><Input id="pc-max" inputMode="decimal" value={draft.maxDiscount} onChange={(event) => set("maxDiscount", event.target.value)} className="h-10 text-sm" /></Field>
                </>
              ) : (
                <Field label="Amount off (₹)" htmlFor="pc-fixed"><Input id="pc-fixed" inputMode="decimal" value={draft.fixed} onChange={(event) => set("fixed", event.target.value)} className="h-10 text-sm" /></Field>
              )}
              <Field label="Minimum order (₹)" htmlFor="pc-min" hint="Optional."><Input id="pc-min" inputMode="decimal" value={draft.minOrder} onChange={(event) => set("minOrder", event.target.value)} className="h-10 text-sm" /></Field>
              <Field label="Starts" htmlFor="pc-start" hint="Optional."><Input id="pc-start" type="datetime-local" value={draft.startsAt} onChange={(event) => set("startsAt", event.target.value)} className="h-10 text-sm" /></Field>
              <Field label="Expires" htmlFor="pc-end" hint="Optional."><Input id="pc-end" type="datetime-local" value={draft.expiresAt} onChange={(event) => set("expiresAt", event.target.value)} className="h-10 text-sm" /></Field>
              <Field label="Total uses allowed" htmlFor="pc-uses" hint="Empty = unlimited."><Input id="pc-uses" inputMode="numeric" value={draft.maxUses} onChange={(event) => set("maxUses", event.target.value)} className="h-10 text-sm" /></Field>
              <Field label="Uses per customer" htmlFor="pc-per" hint="Empty = unlimited."><Input id="pc-per" inputMode="numeric" value={draft.maxPerCustomer} onChange={(event) => set("maxPerCustomer", event.target.value)} className="h-10 text-sm" /></Field>
              <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
                <Switch checked={draft.isActive} onCheckedChange={(checked) => set("isActive", checked)} aria-label="Active" /> Active
              </label>
              {error ? <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{error}</p> : null}
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
                <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save coupon"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        destructive
        title={`Delete ${removing?.code}?`}
        description="This coupon has never been used. This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!removing) return;
          await adminCall("promotions.delete", { id: removing.id });
          router.refresh();
        }}
      />
    </>
  );
}
