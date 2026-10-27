"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminCall } from "@/lib/admin/client";
import { paiseToRupeesInput, parseRupees } from "@/lib/admin/money";
import {
  contactSettingsSchema,
  deliverySettingsSchema,
  notificationSettingsSchema,
  storeSettingsSchema,
  type ContactSettings,
  type DeliverySettings,
  type NotificationSettings,
  type StoreSettings,
} from "@/lib/admin/schemas/settings";
import { ImageUploader } from "./image-uploader";
import { SectionCard } from "./table-card";
import { useAdminAction } from "./use-admin-action";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Actions({ busy, error, label }: { busy: boolean; error: string | null; label: string }) {
  return (
    <div className="space-y-2">
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : label}</Button>
    </div>
  );
}

export function StoreSettingsForm({ initial }: { initial: StoreSettings }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = storeSettingsSchema.safeParse(v);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please check the form.");
    setError(null);
    await run(() => adminCall("settings.saveStore", parsed.data), { success: "Store settings saved" });
  }

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard title="Store details" description="Shown in the storefront footer and on receipts.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="st-name"><Input id="st-name" value={v.businessName} onChange={(e) => setV({ ...v, businessName: e.target.value })} maxLength={80} className="h-10 text-sm" /></Field>
          <Field label="Tagline" htmlFor="st-tag"><Input id="st-tag" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} maxLength={120} className="h-10 text-sm" /></Field>
          <Field label="Contact email" htmlFor="st-email"><Input id="st-email" type="email" value={v.contactEmail} onChange={(e) => setV({ ...v, contactEmail: e.target.value })} className="h-10 text-sm" /></Field>
          <Field label="Contact phone" htmlFor="st-phone"><Input id="st-phone" value={v.contactPhone} onChange={(e) => setV({ ...v, contactPhone: e.target.value })} maxLength={30} className="h-10 text-sm" /></Field>
          <div className="sm:col-span-2"><Field label="Business address" htmlFor="st-addr"><Textarea id="st-addr" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} rows={2} maxLength={300} className="text-sm" /></Field></div>
          <Field label="Website" htmlFor="st-url" hint="Starts with https://"><Input id="st-url" value={v.websiteUrl} onChange={(e) => setV({ ...v, websiteUrl: e.target.value })} className="h-10 text-sm" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Currency" htmlFor="st-cur"><Input id="st-cur" value="INR (₹)" readOnly className="h-10 text-sm" /></Field>
            <Field label="Time zone" htmlFor="st-tz"><Input id="st-tz" value="Asia/Kolkata" readOnly className="h-10 text-sm" /></Field>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold">Logo</Label>
            <ImageUploader single folder="branding" label="Business logo" images={v.logoUrl ? [{ src: v.logoUrl, alt: "" }] : []} onChange={(images) => setV({ ...v, logoUrl: images[0]?.src ?? null })} />
            <p className="text-xs text-muted-foreground">The storefront keeps using the built-in SuperWalls logo files; this is stored for receipts and future use.</p>
          </div>
        </div>
        <div className="mt-5"><Actions busy={busy} error={error} label="Save store settings" /></div>
      </SectionCard>
    </form>
  );
}

const listToText = (list: string[]) => list.join("\n");
const textToList = (text: string) => [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];

export function DeliverySettingsForm({ initial }: { initial: DeliverySettings }) {
  const [fee, setFee] = useState(paiseToRupeesInput(initial.deliveryFeePaise));
  const [free, setFree] = useState(initial.freeDeliveryThresholdPaise === null ? "" : paiseToRupeesInput(initial.freeDeliveryThresholdPaise));
  const [min, setMin] = useState(initial.minOrderPaise > 0 ? paiseToRupeesInput(initial.minOrderPaise) : "");
  const [pins, setPins] = useState(listToText(initial.serviceablePincodes));
  const [cities, setCities] = useState(initial.serviceableCities.join("\n"));
  const [policy, setPolicy] = useState(initial.policyText);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const feePaise = parseRupees(fee);
    const freePaise = free.trim() ? parseRupees(free) : null;
    const minPaise = min.trim() ? parseRupees(min) : 0;
    if (feePaise === null || (free.trim() && freePaise === null) || minPaise === null) return setError("Enter amounts in rupees, like 49 or 499.50.");
    const parsed = deliverySettingsSchema.safeParse({
      deliveryFeePaise: feePaise,
      freeDeliveryThresholdPaise: freePaise,
      minOrderPaise: minPaise,
      serviceablePincodes: textToList(pins),
      serviceableCities: cities.split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean),
      policyText: policy,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please check the form.");
    setError(null);
    await run(() => adminCall("settings.saveDelivery", parsed.data), { success: "Delivery settings saved" });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <SectionCard title="Delivery charges" description="Checkout always uses these numbers, applied on the server.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Standard delivery charge (₹)" htmlFor="dl-fee"><Input id="dl-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} className="h-10 text-sm" /></Field>
          <Field label="Free delivery from (₹)" htmlFor="dl-free" hint="Empty = delivery is never free."><Input id="dl-free" inputMode="decimal" value={free} onChange={(e) => setFree(e.target.value)} className="h-10 text-sm" /></Field>
          <Field label="Minimum order (₹)" htmlFor="dl-min" hint="Empty = no minimum."><Input id="dl-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className="h-10 text-sm" /></Field>
        </div>
      </SectionCard>
      <SectionCard title="Where you deliver" description="Leave both lists empty to deliver everywhere.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Serviceable PIN codes" htmlFor="dl-pins" hint="One per line or separated by commas. When filled, only these PIN codes can order.">
            <Textarea id="dl-pins" value={pins} onChange={(e) => setPins(e.target.value)} rows={6} className="font-mono text-sm" />
          </Field>
          <Field label="Serviceable cities" htmlFor="dl-cities" hint="One per line. Used only when no PIN codes are listed.">
            <Textarea id="dl-cities" value={cities} onChange={(e) => setCities(e.target.value)} rows={6} className="text-sm" />
          </Field>
        </div>
      </SectionCard>
      <SectionCard title="Delivery policy text" description="Internal note you can reuse on the Shipping Policy page.">
        <Textarea aria-label="Delivery policy text" value={policy} onChange={(e) => setPolicy(e.target.value)} rows={4} maxLength={2000} className="text-sm" />
      </SectionCard>
      <Actions busy={busy} error={error} label="Save delivery settings" />
    </form>
  );
}

export function ContactSettingsForm({ initial }: { initial: ContactSettings }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = contactSettingsSchema.safeParse(v);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Please check the form.");
    setError(null);
    await run(() => adminCall("settings.saveContact", parsed.data), { success: "Contact settings saved" });
  }

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard title="Customer support" description="Shown on the Help page, in the footer and behind every WhatsApp button.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Support phone" htmlFor="ct-phone"><Input id="ct-phone" value={v.supportPhone} onChange={(e) => setV({ ...v, supportPhone: e.target.value })} maxLength={30} className="h-10 text-sm" /></Field>
          <Field label="Support email" htmlFor="ct-email"><Input id="ct-email" type="email" value={v.supportEmail} onChange={(e) => setV({ ...v, supportEmail: e.target.value })} className="h-10 text-sm" /></Field>
          <Field label="WhatsApp business number" htmlFor="ct-wa" hint="Digits with country code, no +. Example: 919876543210."><Input id="ct-wa" inputMode="numeric" value={v.whatsappNumber} onChange={(e) => setV({ ...v, whatsappNumber: e.target.value })} maxLength={15} className="h-10 text-sm" /></Field>
          <Field label="Support hours" htmlFor="ct-hours" hint="For example: Mon–Sat, 10am–6pm."><Input id="ct-hours" value={v.availability} onChange={(e) => setV({ ...v, availability: e.target.value })} maxLength={200} className="h-10 text-sm" /></Field>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The WhatsApp number only powers click-to-chat links. No WhatsApp messages are sent automatically.
        </p>
        <div className="mt-5"><Actions busy={busy} error={error} label="Save contact settings" /></div>
      </SectionCard>
    </form>
  );
}

const NOTIFICATION_ROWS: { key: keyof NotificationSettings; label: string; hint: string }[] = [
  { key: "orderConfirmation", label: "Order confirmation", hint: "When a payment is verified." },
  { key: "orderProcessing", label: "Order processing", hint: "When an order moves to processing." },
  { key: "shippingUpdates", label: "Shipping updates", hint: "When an order ships or is out for delivery." },
  { key: "deliveryUpdates", label: "Delivery updates", hint: "When an order is delivered." },
  { key: "lowStockAlerts", label: "Low-stock alerts", hint: "When a product reaches its alert level." },
];

export function NotificationSettingsForm({ initial }: { initial: NotificationSettings }) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const { run, busy } = useAdminAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = notificationSettingsSchema.safeParse(v);
    if (!parsed.success) return setError("Please check the form.");
    setError(null);
    await run(() => adminCall("settings.saveNotifications", parsed.data), { success: "Notification preferences saved" });
  }

  return (
    <form onSubmit={submit} noValidate>
      <SectionCard title="Notification preferences" description="Records which messages you want once messaging is connected.">
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-brand-yellow-soft px-3 py-2 text-sm text-[#7a5b00]">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Nothing is sent yet. Email and WhatsApp messaging are not connected, so these switches only save your preference for later.
        </p>
        <ul className="divide-y">
          {NOTIFICATION_ROWS.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.hint}</p>
              </div>
              <Switch checked={v[row.key]} onCheckedChange={(checked) => setV({ ...v, [row.key]: checked })} aria-label={row.label} />
            </li>
          ))}
        </ul>
        <div className="mt-5"><Actions busy={busy} error={error} label="Save preferences" /></div>
      </SectionCard>
    </form>
  );
}
