"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ImageOff, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { inventoryAdjustSchema } from "@/lib/admin/schemas/promotions";
import type { InventoryRow } from "@/lib/server/admin/queries/inventory";
import { useCan } from "./admin-provider";
import { AdminBadge, STOCK_BADGE } from "./admin-badge";
import { SimpleSelect } from "./simple-select";
import { TableScroll } from "./table-card";
import { useAdminAction } from "./use-admin-action";

type Mode = "add" | "remove" | "set";

const KINDS = [
  { value: "restock", label: "Restock (new stock arrived)" },
  { value: "adjustment", label: "Adjustment" },
  { value: "correction", label: "Correction (count was wrong)" },
  { value: "damage", label: "Damaged / lost" },
  { value: "return", label: "Customer return" },
];

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const canAdjust = useCan("inventory.adjust");
  const [target, setTarget] = useState<InventoryRow | null>(null);
  const [mode, setMode] = useState<Mode>("add");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("restock");
  const [reason, setReason] = useState("");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  function open(row: InventoryRow) {
    setTarget(row);
    setMode("add");
    setAmount("");
    setKind("restock");
    setReason("");
    setThreshold(String(row.threshold));
    setError(null);
  }

  const parsedAmount = Number(amount);
  const nextStock = !target || !Number.isInteger(parsedAmount) || amount === "" ? null : mode === "set" ? parsedAmount : mode === "add" ? target.stock + parsedAmount : target.stock - parsedAmount;

  async function submit() {
    if (!target) return;
    if (!Number.isInteger(parsedAmount) || parsedAmount < 0 || amount === "") {
      setError("Enter a whole number, 0 or more.");
      return;
    }
    const parsed = inventoryAdjustSchema.safeParse({
      productId: target.id,
      mode: mode === "set" ? "set" : "delta",
      quantity: mode === "remove" ? -parsedAmount : parsedAmount,
      kind,
      reason,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    const ok = await run(() => adminCall("inventory.adjust", parsed.data), { success: "Stock updated" });
    if (ok) setTarget(null);
  }

  async function saveThreshold() {
    if (!target) return;
    const value = Number(threshold);
    if (!Number.isInteger(value) || value < 0) {
      setError("The alert level must be a whole number, 0 or more.");
      return;
    }
    const ok = await run(() => adminCall("inventory.setThreshold", { productId: target.id, threshold: value }), { success: "Alert level saved" });
    if (ok) setTarget(null);
  }

  return (
    <>
      <TableScroll>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Alert at</TableHead>
              <TableHead>Status</TableHead>
              {canAdjust ? <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const badge = STOCK_BADGE[row.state];
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="relative size-10 overflow-hidden rounded-md border bg-muted">
                      {row.imageSrc ? <Image src={row.imageSrc} alt="" fill unoptimized sizes="40px" className="object-cover" /> : <ImageOff className="m-2.5 size-5 text-muted-foreground" aria-hidden />}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <Link href={`/admin/products/${row.id}`} className="block truncate font-semibold text-ink hover:text-primary hover:underline">{row.name}</Link>
                    {!row.published ? <AdminBadge tone="neutral">Unpublished</AdminBadge> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.sku ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.stock}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.reserved > 0 ? <span className="font-semibold text-[#7a5b00]">{row.reserved}</span> : 0}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{row.available}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{row.threshold}</TableCell>
                  <TableCell><AdminBadge tone={badge.tone}>{badge.label}</AdminBadge></TableCell>
                  {canAdjust ? (
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => open(row)}>
                        <SlidersHorizontal aria-hidden /> Adjust
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableScroll>

      <Dialog open={target !== null} onOpenChange={(next) => !next && !busy && setTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {target?.name}: {target?.stock} on hand, {target?.reserved} reserved by open checkouts. Every change is recorded with your name and reason.
            </DialogDescription>
          </DialogHeader>
          {target ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Adjustment type">
                {([["add", "Add"], ["remove", "Remove"], ["set", "Set to"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={mode === key}
                    onClick={() => setMode(key)}
                    className={`rounded-md px-2 py-1.5 text-sm font-semibold ${mode === key ? "bg-white text-primary shadow-xs" : "text-muted-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-amount" className="text-xs font-semibold">{mode === "set" ? "New on-hand count" : "Units"}</Label>
                <Input id="adj-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-10 text-sm" autoFocus />
                {nextStock !== null ? (
                  <p className={`text-xs ${nextStock < target.reserved ? "font-semibold text-danger" : "text-muted-foreground"}`}>
                    {target.stock} → <strong>{nextStock}</strong> on hand
                    {nextStock < target.reserved ? ` (below the ${target.reserved} reserved; not allowed)` : nextStock < 0 ? " (can't go below zero)" : ""}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Type</Label>
                <SimpleSelect value={kind} onValueChange={setKind} options={KINDS} className="h-10" aria-label="Adjustment kind" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-reason" className="text-xs font-semibold">Reason</Label>
                <Textarea id="adj-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={300} className="text-sm" placeholder="For example: supplier delivery #1042" />
              </div>
              <div className="flex items-end gap-2 border-t pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="adj-threshold" className="text-xs font-semibold">Low-stock alert at</Label>
                  <Input id="adj-threshold" inputMode="numeric" value={threshold} onChange={(event) => setThreshold(event.target.value)} className="h-9 w-24 text-sm" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={saveThreshold} disabled={busy}>Save level</Button>
              </div>
              {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Update stock"}</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
