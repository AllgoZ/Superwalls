import Link from "next/link";
import { Bell, Headphones, ShieldCheck, Store, Truck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/server/admin/session";

// Staff-only and per-user: the navigation blocks on the server by design.
export const instant = false;

export const metadata = { title: "Settings" };

const CARDS = [
  { href: "/admin/settings/store", icon: Store, title: "Store", text: "Business name, address, logo, currency and time zone." },
  { href: "/admin/settings/delivery", icon: Truck, title: "Delivery", text: "Delivery charge, free-delivery threshold, minimum order and serviceable areas." },
  { href: "/admin/settings/contact", icon: Headphones, title: "Contact & support", text: "Support phone, email, WhatsApp number and hours." },
  { href: "/admin/settings/notifications", icon: Bell, title: "Notifications", text: "Which messages to send once email and WhatsApp are connected." },
  { href: "/admin/settings/team", icon: ShieldCheck, title: "Team", text: "Invite staff, assign roles, suspend or revoke access." },
] as const;

export default async function SettingsPage() {
  await requireAdmin("settings.manage");
  return (
    <>
      <PageHeader title="Settings" description="Business settings. Only super admins can change these." />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link href={href} className="flex h-full items-start gap-3 rounded-xl border bg-white p-4 shadow-xs transition-colors hover:border-primary/40 hover:bg-brand-blue-soft/40">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft text-primary"><Icon className="size-5" aria-hidden /></span>
              <span>
                <span className="block font-bold text-ink">{title}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
