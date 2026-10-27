import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import {
  DEFAULT_CONTACT,
  DEFAULT_DELIVERY,
  DEFAULT_STORE,
  contactSettingsSchema,
  deliverySettingsSchema,
  storeSettingsSchema,
  type ContactSettings,
  type DeliverySettings,
  type StoreSettings,
} from "@/lib/admin/schemas/settings";
import { footerSchema, DEFAULT_FOOTER, type FooterSettings } from "@/lib/admin/schemas/content";
import { isBackendConfigured, query } from "./db";

/**
 * What the PUBLIC storefront may see of the CMS. Every query keeps the same predicate as the Row Level Security
 * policy for that table (published / active / visible / within dates), because this server connection bypasses RLS.
 *
 * Results are cached and tagged; every admin operation that changes content expires its tag immediately
 * (`revalidateTag(tag, { expire: 0 })`), so edits show up on the next request instead of after a timeout.
 * If the database is unreachable the readers return empty/default content rather than failing the page.
 */
const CACHE = { revalidate: 60, expire: 600 } as const;

export interface PublicBanner {
  id: string;
  heading: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
}

export async function getHomeBanners(): Promise<PublicBanner[]> {
  "use cache";
  cacheTag("content:banners");
  cacheLife(CACHE);
  if (!isBackendConfigured()) return [];
  try {
    const rows = await query<{ id: string; heading: string; subtitle: string; cta_label: string; cta_href: string; desktop_image_url: string | null; mobile_image_url: string | null }>(
      `select id, heading, subtitle, cta_label, cta_href, desktop_image_url, mobile_image_url from homepage_banners
       where is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
       order by sort_order, created_at limit 8`,
    );
    return rows.map((r) => ({ id: r.id, heading: r.heading, subtitle: r.subtitle, ctaLabel: r.cta_label, ctaHref: r.cta_href, desktopImageUrl: r.desktop_image_url, mobileImageUrl: r.mobile_image_url }));
  } catch (error) {
    console.error("[content] banners unavailable:", error instanceof Error ? error.message : error);
    return [];
  }
}

export type SectionKey = "hero" | "promo_strip" | "featured_products" | "brand_intro" | "why_choose" | "benefits" | "support";

export interface PublicSection {
  key: SectionKey;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  items: { title: string; text: string }[];
  sortOrder: number;
}

/** Visible sections only, in display order. */
export async function getVisibleSections(): Promise<PublicSection[]> {
  "use cache";
  cacheTag("content:sections");
  cacheLife(CACHE);
  if (!isBackendConfigured()) return [];
  try {
    const rows = await query<{ key: SectionKey; title: string; body: string; cta_label: string; cta_href: string; items: unknown; sort_order: number }>(
      "select key, title, body, cta_label, cta_href, items, sort_order from cms_sections where is_visible order by sort_order, key",
    );
    return rows.map((r) => ({
      key: r.key,
      title: r.title,
      body: r.body,
      ctaLabel: r.cta_label,
      ctaHref: r.cta_href,
      sortOrder: r.sort_order,
      items: Array.isArray(r.items)
        ? (r.items as { title?: unknown; text?: unknown }[]).flatMap((item) => (typeof item.title === "string" && typeof item.text === "string" ? [{ title: item.title, text: item.text }] : []))
        : [],
    }));
  } catch (error) {
    console.error("[content] sections unavailable:", error instanceof Error ? error.message : error);
    return [];
  }
}

export interface PublicSettings {
  store: StoreSettings;
  contact: ContactSettings;
  delivery: DeliverySettings;
  footer: FooterSettings;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheTag("content:settings");
  cacheLife(CACHE);
  const fallback: PublicSettings = { store: DEFAULT_STORE, contact: DEFAULT_CONTACT, delivery: DEFAULT_DELIVERY, footer: DEFAULT_FOOTER };
  if (!isBackendConfigured()) return fallback;
  try {
    const rows = await query<{ key: string; value: unknown }>("select key, value from store_settings where is_public and key in ('store', 'contact', 'delivery', 'footer')");
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return {
      store: storeSettingsSchema.safeParse(byKey.get("store")).data ?? DEFAULT_STORE,
      contact: contactSettingsSchema.safeParse(byKey.get("contact")).data ?? DEFAULT_CONTACT,
      delivery: deliverySettingsSchema.safeParse(byKey.get("delivery")).data ?? DEFAULT_DELIVERY,
      footer: footerSchema.safeParse(byKey.get("footer")).data ?? DEFAULT_FOOTER,
    };
  } catch (error) {
    console.error("[content] settings unavailable:", error instanceof Error ? error.message : error);
    return fallback;
  }
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

/** Active categories for the storefront filter chips. */
export async function getActiveCategories(): Promise<PublicCategory[]> {
  "use cache";
  cacheTag("categories");
  cacheLife(CACHE);
  if (!isBackendConfigured()) return [];
  try {
    return await query<PublicCategory>("select id, name, slug from categories where is_active order by sort_order, lower(name)");
  } catch (error) {
    console.error("[content] categories unavailable:", error instanceof Error ? error.message : error);
    return [];
  }
}

export interface PublicFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
}

/** `null` means "couldn't load" (the page may fall back to built-in text); an empty array means "none published". */
export async function getActiveFaqs(): Promise<PublicFaq[] | null> {
  "use cache";
  cacheTag("content:faqs");
  cacheLife(CACHE);
  if (!isBackendConfigured()) return null;
  try {
    return await query<PublicFaq>("select id, category, question, answer from faqs where is_active order by sort_order, created_at");
  } catch (error) {
    console.error("[content] faqs unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}

export interface PublicPage {
  slug: string;
  title: string;
  contentMd: string;
  seoTitle: string;
  seoDescription: string;
}

export async function getPublishedPage(slug: string): Promise<PublicPage | null> {
  "use cache";
  cacheTag("content:pages", `content:page:${slug}`);
  cacheLife(CACHE);
  if (!isBackendConfigured()) return null;
  try {
    const rows = await query<{ slug: string; title: string; content_md: string; seo_title: string; seo_description: string }>(
      "select slug, title, content_md, seo_title, seo_description from cms_pages where slug = $1 and status = 'published'",
      [slug],
    );
    const row = rows[0];
    return row ? { slug: row.slug, title: row.title, contentMd: row.content_md, seoTitle: row.seo_title, seoDescription: row.seo_description } : null;
  } catch (error) {
    console.error("[content] page unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
