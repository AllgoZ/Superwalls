"use client";

import Image from "next/image";
import { useState, type FormEvent, type ReactNode } from "react";
import { ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { isoToIstInput, istInputToIso } from "@/lib/admin/datetime";
import { bannerSchema } from "@/lib/admin/schemas/content";
import type { AdminBanner } from "@/lib/server/admin/queries/content";
import { useCan } from "./admin-provider";
import { AdminBadge } from "./admin-badge";
import { ConfirmDialog } from "./confirm-dialog";
import { ImageUploader } from "./image-uploader";
import { useAdminAction } from "./use-admin-action";

interface Draft {
  id?: string;
  heading: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  sortOrder: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
}

const BLANK: Draft = { heading: "", subtitle: "", ctaLabel: "", ctaHref: "", desktopImageUrl: null, mobileImageUrl: null, sortOrder: "0", isActive: true, startsAt: "", endsAt: "" };

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Mirrors how the storefront draws a banner so staff see roughly what customers will. */
function Preview({ draft }: { draft: Draft }) {
  const desktop = draft.desktopImageUrl ?? draft.mobileImageUrl;
  return (
    <div className="relative aspect-[16/7] overflow-hidden rounded-xl bg-brand-blue">
      {desktop ? <Image src={desktop} alt="" fill unoptimized sizes="600px" className="object-cover" /> : null}
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/55 to-transparent p-4 text-white">
        <p className="text-lg font-extrabold">{draft.heading || "Banner heading"}</p>
        {draft.subtitle ? <p className="text-xs text-white/90">{draft.subtitle}</p> : null}
        {draft.ctaLabel ? <span className="mt-2 w-fit rounded-lg bg-brand-yellow px-3 py-1 text-xs font-bold text-ink">{draft.ctaLabel}</span> : null}
      </div>
    </div>
  );
}

export function BannersManager({ banners }: { banners: AdminBanner[] }) {
  const canWrite = useCan("content.write");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AdminBanner | null>(null);
  const { run, busy, router } = useAdminAction();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const parsed = bannerSchema.safeParse({
      id: draft.id,
      heading: draft.heading,
      subtitle: draft.subtitle,
      ctaLabel: draft.ctaLabel,
      ctaHref: draft.ctaHref,
      desktopImageUrl: draft.desktopImageUrl,
      mobileImageUrl: draft.mobileImageUrl,
      sortOrder: Number(draft.sortOrder),
      isActive: draft.isActive,
      startsAt: istInputToIso(draft.startsAt),
      endsAt: istInputToIso(draft.endsAt),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    if (!parsed.data.desktopImageUrl && !parsed.data.mobileImageUrl) {
      setError("Upload at least one banner image.");
      return;
    }
    setError(null);
    const ok = await run(() => adminCall("banners.save", parsed.data), { success: draft.id ? "Banner saved" : "Banner created" });
    if (ok) setDraft(null);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Active banners replace the default hero on the homepage. With several, customers swipe between them.
        </p>
        {canWrite ? (
          <Button size="sm" onClick={() => { setDraft({ ...BLANK, sortOrder: String((banners.at(-1)?.sortOrder ?? 0) + 10) }); setError(null); }}>
            <Plus aria-hidden /> New banner
          </Button>
        ) : null}
      </div>

      {banners.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-white px-4 py-10 text-center text-sm text-muted-foreground">No banners yet. The storefront shows the default hero.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {banners.map((banner) => {
            const image = banner.desktopImageUrl ?? banner.mobileImageUrl;
            return (
              <li key={banner.id} className="overflow-hidden rounded-xl border bg-white shadow-xs">
                <div className="relative aspect-[16/6] bg-muted">
                  {image ? <Image src={image} alt="" fill unoptimized sizes="500px" className="object-cover" /> : <ImageOff className="m-auto size-8 text-muted-foreground" aria-hidden />}
                </div>
                <div className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{banner.heading}</p>
                    <p className="text-xs text-muted-foreground">Order {banner.sortOrder}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <AdminBadge tone={banner.live ? "success" : "neutral"}>{banner.live ? "Live" : banner.isActive ? "Scheduled / expired" : "Inactive"}</AdminBadge>
                    </div>
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${banner.heading}`}
                        onClick={() => {
                          setError(null);
                          setDraft({
                            id: banner.id, heading: banner.heading, subtitle: banner.subtitle, ctaLabel: banner.ctaLabel, ctaHref: banner.ctaHref,
                            desktopImageUrl: banner.desktopImageUrl, mobileImageUrl: banner.mobileImageUrl, sortOrder: String(banner.sortOrder),
                            isActive: banner.isActive, startsAt: isoToIstInput(banner.startsAt), endsAt: isoToIstInput(banner.endsAt),
                          });
                        }}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-danger" aria-label={`Delete ${banner.heading}`} onClick={() => setRemoving(banner)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={draft !== null} onOpenChange={(next) => !next && !busy && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit banner" : "New banner"}</DialogTitle>
            <DialogDescription>Dates are in India time. Leave them empty to run the banner until you turn it off.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
              <div className="sm:col-span-2"><Preview draft={draft} /></div>
              <div className="sm:col-span-2">
                <Field label="Heading" htmlFor="bn-heading"><Input id="bn-heading" value={draft.heading} onChange={(event) => set("heading", event.target.value)} maxLength={120} className="h-10 text-sm" /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Subtitle" htmlFor="bn-sub"><Textarea id="bn-sub" value={draft.subtitle} onChange={(event) => set("subtitle", event.target.value)} rows={2} maxLength={240} className="text-sm" /></Field>
              </div>
              <Field label="Button label" htmlFor="bn-cta" hint="Optional."><Input id="bn-cta" value={draft.ctaLabel} onChange={(event) => set("ctaLabel", event.target.value)} maxLength={40} className="h-10 text-sm" /></Field>
              <Field label="Button link" htmlFor="bn-href" hint="/ for pages on this site, or https://"><Input id="bn-href" value={draft.ctaHref} onChange={(event) => set("ctaHref", event.target.value)} placeholder="/#products" className="h-10 text-sm" /></Field>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Desktop image</Label>
                <ImageUploader single folder="banners" label="Desktop banner image" images={draft.desktopImageUrl ? [{ src: draft.desktopImageUrl, alt: "" }] : []} onChange={(images) => set("desktopImageUrl", images[0]?.src ?? null)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Mobile image (optional)</Label>
                <ImageUploader single folder="banners" label="Mobile banner image" images={draft.mobileImageUrl ? [{ src: draft.mobileImageUrl, alt: "" }] : []} onChange={(images) => set("mobileImageUrl", images[0]?.src ?? null)} />
              </div>
              <Field label="Starts" htmlFor="bn-start"><Input id="bn-start" type="datetime-local" value={draft.startsAt} onChange={(event) => set("startsAt", event.target.value)} className="h-10 text-sm" /></Field>
              <Field label="Ends" htmlFor="bn-end"><Input id="bn-end" type="datetime-local" value={draft.endsAt} onChange={(event) => set("endsAt", event.target.value)} className="h-10 text-sm" /></Field>
              <Field label="Display order" htmlFor="bn-order" hint="Lower numbers come first."><Input id="bn-order" inputMode="numeric" value={draft.sortOrder} onChange={(event) => set("sortOrder", event.target.value)} className="h-10 w-28 text-sm" /></Field>
              <label className="flex items-center gap-3 self-end pb-2 text-sm font-semibold">
                <Switch checked={draft.isActive} onCheckedChange={(checked) => set("isActive", checked)} aria-label="Active" /> Active
              </label>
              {error ? <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{error}</p> : null}
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
                <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save banner"}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        destructive
        title={`Delete "${removing?.heading}"?`}
        description="It disappears from the storefront straight away. This can't be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!removing) return;
          await adminCall("banners.delete", { id: removing.id });
          router.refresh();
        }}
      />
    </>
  );
}
