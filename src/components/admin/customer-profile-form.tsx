"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminCall } from "@/lib/admin/client";
import { useCan } from "./admin-provider";
import { useAdminAction } from "./use-admin-action";

/** Name and phone corrections only. Email, password and sessions belong to Supabase Auth and can't be edited here. */
export function CustomerProfileForm({ userId, fullName, mobile }: { userId: string; fullName: string; mobile: string }) {
  const canEdit = useCan("customers.update");
  const [name, setName] = useState(fullName);
  const [phone, setPhone] = useState(mobile);
  const { run, busy } = useAdminAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(() => adminCall("customers.updateProfile", { userId, fullName: name, mobile: phone }), { success: "Profile updated" });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cust-name" className="text-xs font-semibold">Full name</Label>
        <Input id="cust-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit || busy} maxLength={80} className="h-10 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cust-phone" className="text-xs font-semibold">Mobile</Label>
        <Input id="cust-phone" inputMode="numeric" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={!canEdit || busy} maxLength={10} className="h-10 text-sm" />
      </div>
      {canEdit ? (
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Saving…" : "Save corrections"}
        </Button>
      ) : null}
    </form>
  );
}
