import Link from "next/link";
import { Banknote, BadgeCheck, MessageCircle, PackageSearch, ShieldCheck, Sparkles, Tag, Truck, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import type { SupportInfo } from "@/lib/config/support";
import { siteConfig } from "@/lib/config/site";
import { formatINR } from "@/lib/formatters";
import type { PublicSection, PublicSettings } from "@/lib/server/content";

const ICONS: LucideIcon[] = [Banknote, PackageSearch, MessageCircle, ShieldCheck, Truck, BadgeCheck, Sparkles, Tag];

/** "Why choose us" and "Customer benefits": a row of short points. */
export function FeatureStrip({ section }: { section: PublicSection }) {
  if (section.items.length === 0) return null;
  return (
    <section aria-label={section.title || "Highlights"} className="px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {section.title ? <h2 className="mb-3 text-lg font-extrabold text-ink md:text-xl">{section.title}</h2> : null}
        <ul className="grid gap-3 sm:grid-cols-3">
          {section.items.map(({ title, text }, index) => {
            const Icon = ICONS[index % ICONS.length]!;
            return (
              <li key={`${title}-${index}`} className="flex items-start gap-3 rounded-2xl bg-soft p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-blue">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-ink">{title}</p>
                  {text ? <p className="text-sm text-muted-foreground">{text}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** One highlighted line. {threshold} becomes the live free-delivery amount from Delivery settings. */
export function PromoStrip({ section, thresholdPaise }: { section: PublicSection; thresholdPaise: number | null }) {
  const usesThreshold = section.title.includes("{threshold}") || section.body.includes("{threshold}");
  if (usesThreshold && thresholdPaise === null) return null;
  const fill = (text: string) => text.replaceAll("{threshold}", thresholdPaise === null ? "" : formatINR(thresholdPaise));
  if (!section.title && !section.body) return null;

  return (
    <section aria-label="Offer" className="px-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-2xl bg-brand-yellow-soft p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-ink">
          <Tag className="size-5" aria-hidden />
        </span>
        <p className="text-sm text-ink">
          {section.title ? <span className="font-bold">{fill(section.title)}</span> : null}
          {section.body ? <span className="text-muted-foreground"> {fill(section.body)}</span> : null}
        </p>
      </div>
    </section>
  );
}

export function BrandIntro({ section }: { section: PublicSection }) {
  const paragraphs = section.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <section aria-label={section.title || "About"} className="px-4 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-2 text-center">
        {section.title ? <h2 className="text-lg font-extrabold text-ink md:text-xl">{section.title}</h2> : null}
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

export function SupportCallout({ section, support }: { section: PublicSection; support: SupportInfo }) {
  return (
    <section aria-label={section.title || "Support"} className="px-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-blue-soft p-4">
        <div>
          {section.title ? <p className="text-base font-bold text-ink">{section.title}</p> : null}
          {section.body ? <p className="text-sm text-muted-foreground">{section.body}</p> : null}
          {support.availability ? <p className="mt-1 text-xs text-muted-foreground">{support.availability}</p> : null}
        </div>
        {section.ctaLabel && section.ctaHref ? (
          <Link href={section.ctaHref} className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue-dark">
            {section.ctaLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} className="hover:text-brand-blue">
        {label}
      </Link>
    );
  }
  if (href.startsWith("https://")) {
    return (
      <a href={href} className="hover:text-brand-blue" target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    );
  }
  return (
    <a href={href} className="hover:text-brand-blue">
      {label}
    </a>
  );
}

/** Footer content comes from the admin panel. Nothing here is invented: empty fields are simply not shown. */
export function SiteFooter({ settings }: { settings: PublicSettings }) {
  const { footer, store, contact } = settings;
  const links = [...footer.usefulLinks, ...footer.policyLinks];
  const description = footer.description || store.tagline || siteConfig.tagline;
  const phone = contact.supportPhone || store.contactPhone;
  const email = contact.supportEmail || store.contactEmail;

  return (
    <footer className="mt-4 border-t bg-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground">{description}</p>
          {store.address ? <p className="text-sm text-muted-foreground">{store.address}</p> : null}
          {phone || email ? (
            <p className="text-sm text-muted-foreground">
              {phone ? (
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-brand-blue">
                  {phone}
                </a>
              ) : null}
              {phone && email ? " · " : null}
              {email ? (
                <a href={`mailto:${email}`} className="hover:text-brand-blue">
                  {email}
                </a>
              ) : null}
            </p>
          ) : null}
          {footer.socialLinks.length > 0 ? (
            <ul className="flex flex-wrap gap-3 text-sm font-medium text-ink">
              {footer.socialLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="hover:text-brand-blue">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {links.length > 0 ? (
          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm font-medium text-ink">
              {links.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
      <p className="border-t px-4 py-4 text-center text-xs text-muted-foreground">{footer.copyright || `© ${store.businessName || siteConfig.name}`}</p>
    </footer>
  );
}
