"use client";

import { useState, type FormEvent } from "react";
import { Ban, MailPlus, RotateCcw, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminCall } from "@/lib/admin/client";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type AdminRole } from "@/lib/admin/permissions";
import { formatDateTime } from "@/lib/formatters/date";
import type { TeamMember } from "@/lib/server/admin/queries/team";
import { AdminBadge, type Tone } from "./admin-badge";
import { ConfirmDialog } from "./confirm-dialog";
import { SimpleSelect } from "./simple-select";
import { TableCard, TableScroll } from "./table-card";
import { useAdminAction } from "./use-admin-action";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  invited: { label: "Invited", tone: "info" },
  suspended: { label: "Suspended", tone: "warning" },
  revoked: { label: "Revoked", tone: "neutral" },
};

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));

export function TeamManager({ members }: { members: TeamMember[] }) {
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("manager");
  const [confirm, setConfirm] = useState<{ member: TeamMember; status: "suspended" | "revoked" } | null>(null);
  const { run, busy, router } = useAdminAction();

  async function invite(event: FormEvent) {
    event.preventDefault();
    const result = await run(() => adminCall<{ status: string }>("team.invite", { email, displayName: name, role }), { success: "Done", refresh: true });
    if (result) {
      setInviting(false);
      setEmail("");
      setName("");
    }
  }

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Staff sign in at <span className="font-mono">/admin/login</span> with a normal SuperWalls account. An invitation lets that person&apos;s verified email become staff; it does not create the account or send an email.
          There is no public admin registration.
        </p>
        <Button size="sm" onClick={() => setInviting(true)}>
          <MailPlus aria-hidden /> Invite
        </Button>
      </div>

      <TableCard>
        <TableScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="w-44"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const status = STATUS[member.status] ?? STATUS.revoked!;
                const editable = !member.isSelf && member.status !== "revoked";
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <p className="font-semibold text-ink">{member.displayName || member.email} {member.isSelf ? <AdminBadge tone="info">You</AdminBadge> : null}</p>
                      <p className="text-xs break-all text-muted-foreground">{member.email}</p>
                    </TableCell>
                    <TableCell className="min-w-44">
                      {editable ? (
                        <SimpleSelect
                          aria-label={`Role for ${member.email}`}
                          value={member.role}
                          disabled={busy}
                          options={ROLE_OPTIONS}
                          onValueChange={(next) => next !== member.role && run(() => adminCall("team.update", { memberId: member.id, role: next }), { success: "Role updated" })}
                        />
                      ) : (
                        ROLE_LABEL[member.role]
                      )}
                    </TableCell>
                    <TableCell>
                      <AdminBadge tone={member.inviteExpired ? "danger" : status.tone}>{member.inviteExpired ? "Invitation expired" : status.label}</AdminBadge>
                      {member.status === "invited" && member.inviteExpiresAt && !member.inviteExpired ? <p className="mt-0.5 text-[0.7rem] text-muted-foreground">until {formatDateTime(member.inviteExpiresAt)}</p> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}</TableCell>
                    <TableCell>
                      {editable ? (
                        <div className="flex justify-end gap-1">
                          {member.status === "active" ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ member, status: "suspended" })}>
                              <Ban aria-hidden /> Suspend
                            </Button>
                          ) : null}
                          {member.status === "suspended" ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => adminCall("team.update", { memberId: member.id, status: "active" }), { success: "Access restored" })}>
                              <RotateCcw aria-hidden /> Restore
                            </Button>
                          ) : null}
                          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirm({ member, status: "revoked" })}>
                            <ShieldOff aria-hidden /> Revoke
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableScroll>
      </TableCard>

      <section aria-labelledby="roles-heading" className="mt-6">
        <h2 id="roles-heading" className="mb-2 text-sm font-bold text-ink">What each role can do</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="rounded-lg border bg-white px-3 py-2">
              <dt className="text-sm font-semibold text-ink">{ROLE_LABEL[r]}</dt>
              <dd className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Dialog open={inviting} onOpenChange={(next) => !busy && setInviting(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              If they already have a verified account they become staff immediately. Otherwise they get access when they first sign in at /admin/login with this email, within 7 days.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={invite} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email" className="text-xs font-semibold">Email</Label>
              <Input id="inv-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-10 text-sm" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-name" className="text-xs font-semibold">Name (optional)</Label>
              <Input id="inv-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="h-10 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Role</Label>
              <SimpleSelect value={role} onValueChange={(next) => setRole(next as AdminRole)} options={ROLE_OPTIONS} className="h-10" aria-label="Role" />
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[role]}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setInviting(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" size="sm" disabled={busy || !email.includes("@")}>{busy ? "Inviting…" : "Invite"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        destructive
        title={confirm?.status === "revoked" ? `Revoke ${confirm.member.email}?` : `Suspend ${confirm?.member.email}?`}
        description={confirm?.status === "revoked" ? "They lose admin access permanently and their sessions stop working immediately. To give access again you must invite them anew." : "Their sessions stop working immediately. You can restore access later."}
        confirmLabel={confirm?.status === "revoked" ? "Revoke access" : "Suspend"}
        onConfirm={async () => {
          if (!confirm) return;
          await adminCall("team.update", { memberId: confirm.member.id, status: confirm.status });
          router.refresh();
        }}
      />
    </>
  );
}
