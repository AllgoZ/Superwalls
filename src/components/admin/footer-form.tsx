"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { footerSchema, type FooterSettings } from "@/lib/admin/schemas/content";
import { useCan } from "./admin-provider";
import { useAdminAction } from "./use-admin-action";

type Links = { label: string; href: string }[];

function LinkList({ title, hint, links, onChange, disabled, max, hrefPlaceholder }: { title: string; hint?: string; links: Links; onChange: (links: Links) => void; disabled: boolean; max: number; hrefPlaceholder: string }) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs font-semibold">{title}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {links.map((link, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
          <Input aria-label={`${title} ${index + 1} label`} value={link.label} disabled={disabled} onChange={(event) => onChange(links.map((l, i) => (i === index ? { ...l, label: event.target.value } : l)))} placeholder="Label" maxLength={40} className="h-9 text-sm" />
          <Input aria-label={`${title} ${index + 1} link`} value={link.href} disabled={disabled} onChange={(event) => onChange(links.map((l, i) => (i === index ? { ...l, href: event.target.value } : l)))} placeholder={hrefPlaceholder} className="h-9 text-sm" />
          <Button type="button" variant="ghost" size="icon-sm" className="text-danger" disabled={disabled} aria-label={`Remove ${title} ${index + 1}`} onClick={() => onChange(links.filter((_, i) => i !== index))}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      {links.length < max ? (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...links, { label: "", href: "" }])}>
          <Plus aria-hidden /> Add link
        </Button>
      ) : null}
    </div>
  );
}

export function FooterForm({ initial }: { initial: FooterSettings }) {
  const canWrite = useCan("content.write");
  const [value, setValue] = useState<FooterSettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = footerSchema.safeParse(value);
    if (!parsed.success) {
      setError(`${parsed.error.issues[0]?.path.join(" › ") ?? ""} ${parsed.error.issues[0]?.message ?? "Please check the form."}`.trim());
      return;
    }
    setError(null);
    await run(() => adminCall("footer.save", parsed.data), { success: "Footer saved" });
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6 rounded-xl border bg-white p-4 shadow-xs" noValidate>
      <p className="text-sm text-muted-foreground">
        Contact details in the footer come from Settings (store and contact). Leave anything blank to hide it: nothing is filled in for you.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="ft-desc" className="text-xs font-semibold">Footer description</Label>
        <Textarea id="ft-desc" value={value.description} disabled={!canWrite} onChange={(event) => setValue({ ...value, description: event.target.value })} rows={2} maxLength={300} className="text-sm" placeholder="Defaults to your tagline" />
      </div>
      <LinkList title="Useful links" links={value.usefulLinks} disabled={!canWrite} max={10} hrefPlaceholder="/help" onChange={(usefulLinks) => setValue({ ...value, usefulLinks })} />
      <LinkList title="Policy links" hint="For example Privacy, Terms, Shipping (/shipping) and Refund (/refund-policy) once those pages are published." links={value.policyLinks} disabled={!canWrite} max={10} hrefPlaceholder="/privacy" onChange={(policyLinks) => setValue({ ...value, policyLinks })} />
      <LinkList title="Social media" hint="Full https:// addresses." links={value.socialLinks} disabled={!canWrite} max={8} hrefPlaceholder="https://instagram.com/…" onChange={(socialLinks) => setValue({ ...value, socialLinks })} />
      <div className="space-y-1.5">
        <Label htmlFor="ft-copy" className="text-xs font-semibold">Copyright text</Label>
        <Input id="ft-copy" value={value.copyright} disabled={!canWrite} onChange={(event) => setValue({ ...value, copyright: event.target.value })} maxLength={160} className="h-10 text-sm" placeholder="Defaults to © and your business name" />
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      {canWrite ? <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save footer"}</Button> : null}
    </form>
  );
}
