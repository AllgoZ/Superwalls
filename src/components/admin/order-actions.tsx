"use client";

import { useState } from "react";
import { ArrowRight, Printer, RefreshCw, StickyNote, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { PermissionGuard } from "./admin-provider";
import { useAdminAction } from "./use-admin-action";

const NEXT: Record<string, { status: "confirmed" | "processing" | "shipped" | "out_for_delivery" | "delivered"; label: string } | undefined> = {
  placed: { status: "confirmed", label: "Confirm order" },
  confirmed: { status: "processing", label: "Start processing" },
  processing: { status: "shipped", label: "Mark as shipped" },
  shipped: { status: "out_for_delivery", label: "Out for delivery" },
  out_for_delivery: { status: "delivered", label: "Mark as delivered" },
};
const CANCELLABLE = new Set(["pending_payment", "placed", "confirmed", "processing"]);

export function OrderActions({ orderId, orderStatus, paymentStatus }: { orderId: string; orderStatus: string; paymentStatus: string }) {
  const { run, busy, router } = useAdminAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const paid = paymentStatus === "paid";
  const next = paid ? NEXT[orderStatus] : undefined;
  const canCancel = CANCELLABLE.has(orderStatus);

  async function cancel() {
    const result = await run(() => adminCall("orders.cancel", { orderId, reason }), { success: "Order cancelled" });
    if (result) {
      setCancelOpen(false);
      setReason("");
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => router.refresh()} disabled={busy}>
        <RefreshCw aria-hidden /> Refresh
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden /> Print
      </Button>
      <PermissionGuard permission="orders.update">
        {next ? (
          <Button size="sm" disabled={busy} onClick={() => run(() => adminCall("orders.setStatus", { orderId, status: next.status }), { success: `Order ${next.status.replace(/_/g, " ")}` })}>
            <ArrowRight aria-hidden /> {next.label}
          </Button>
        ) : null}
        {canCancel ? (
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => setCancelOpen(true)}>
            <XCircle aria-hidden /> Cancel order
          </Button>
        ) : null}
      </PermissionGuard>

      <Dialog open={cancelOpen} onOpenChange={(open) => !busy && setCancelOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              {paid
                ? "The customer has already paid. Stock goes back on the shelf and the payment is flagged as needing a refund. No refund is issued from here: refunds are handled through the payment gateway."
                : "The customer hasn't paid. Reserved stock is released and any open payment attempt is closed."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label htmlFor="cancel-reason" className="text-xs font-semibold">Reason (kept in the order history)</label>
            <Textarea id="cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={300} className="text-sm" placeholder="For example: customer requested cancellation" />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCancelOpen(false)} disabled={busy}>Keep order</Button>
            <Button variant="destructive" size="sm" onClick={cancel} disabled={busy || reason.trim().length < 5}>
              {busy ? "Cancelling…" : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const { run, busy } = useAdminAction();
  const [note, setNote] = useState("");

  async function submit() {
    const ok = await run(() => adminCall("orders.addNote", { orderId, note }), { success: "Note added" });
    if (ok) setNote("");
  }

  return (
    <PermissionGuard permission="orders.update">
      <div className="space-y-2 print:hidden">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={1000} placeholder="Add an internal note (customers never see this)" aria-label="Internal note" className="text-sm" />
        <Button size="sm" variant="outline" onClick={submit} disabled={busy || note.trim().length === 0}>
          <StickyNote aria-hidden /> Add note
        </Button>
      </div>
    </PermissionGuard>
  );
}
