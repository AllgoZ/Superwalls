import "server-only";
import { PAGE_SLUGS, SECTION_KEYS, footerSchema, DEFAULT_FOOTER, type FooterSettings, type PageSlug, type SectionKeyName } from "@/lib/admin/schemas/content";
import { query, queryOne } from "../../db";
import { assertCan, type AdminContext } from "../session";

export interface AdminBanner {
  id: string;
  heading: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  /** Whether it is on the storefront right now (active and inside its dates). */
  live: boolean;
}

export async function listBanners(admin: AdminContext): Promise<AdminBanner[]> {
  assertCan(admin, "content.read");
  const rows = await query<{
    id: string; heading: string; subtitle: string; cta_label: string; cta_href: string; desktop_image_url: string | null; mobile_image_url: string | null;
    sort_order: number; is_active: boolean; starts_at: string | null; ends_at: string | null; live: boolean;
  }>(
    `select *, (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) as live
     from homepage_banners order by sort_order, created_at`,
  );
  return rows.map((r) => ({
    id: r.id, heading: r.heading, subtitle: r.subtitle, ctaLabel: r.cta_label, ctaHref: r.cta_href, desktopImageUrl: r.desktop_image_url,
    mobileImageUrl: r.mobile_image_url, sortOrder: r.sort_order, isActive: r.is_active, startsAt: r.starts_at, endsAt: r.ends_at, live: r.live,
  }));
}

export interface AdminSection {
  key: SectionKeyName;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  items: { title: string; text: string }[];
  isVisible: boolean;
  sortOrder: number;
}

export async function listSections(admin: AdminContext): Promise<AdminSection[]> {
  assertCan(admin, "content.read");
  const rows = await query<{ key: SectionKeyName; title: string; body: string; cta_label: string; cta_href: string; items: unknown; is_visible: boolean; sort_order: number }>(
    "select key, title, body, cta_label, cta_href, items, is_visible, sort_order from cms_sections order by sort_order, key",
  );
  const found = rows
    .filter((r) => (SECTION_KEYS as readonly string[]).includes(r.key))
    .map((r) => ({
      key: r.key,
      title: r.title,
      body: r.body,
      ctaLabel: r.cta_label,
      ctaHref: r.cta_href,
      isVisible: r.is_visible,
      sortOrder: r.sort_order,
      items: Array.isArray(r.items)
        ? (r.items as { title?: unknown; text?: unknown }[]).flatMap((i) => (typeof i.title === "string" ? [{ title: i.title, text: typeof i.text === "string" ? i.text : "" }] : []))
        : [],
    }));
  return found;
}

export async function getFooter(admin: AdminContext): Promise<FooterSettings> {
  assertCan(admin, "content.read");
  const row = await queryOne<{ value: unknown }>("select value from store_settings where key = 'footer'");
  return footerSchema.safeParse(row?.value).data ?? DEFAULT_FOOTER;
}

export interface AdminPageRow {
  slug: PageSlug;
  title: string;
  contentMd: string;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published" | "missing";
  updatedAt: string | null;
}

export async function listPages(admin: AdminContext): Promise<AdminPageRow[]> {
  assertCan(admin, "content.read");
  const rows = await query<{ slug: PageSlug; title: string; content_md: string; seo_title: string; seo_description: string; status: "draft" | "published"; updated_at: string }>(
    "select slug, title, content_md, seo_title, seo_description, status, updated_at from cms_pages",
  );
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return PAGE_SLUGS.map((slug) => {
    const r = bySlug.get(slug);
    return r
      ? { slug, title: r.title, contentMd: r.content_md, seoTitle: r.seo_title, seoDescription: r.seo_description, status: r.status, updatedAt: r.updated_at }
      : { slug, title: "", contentMd: "", seoTitle: "", seoDescription: "", status: "missing" as const, updatedAt: null };
  });
}

export interface AdminFaq {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export async function listFaqs(admin: AdminContext): Promise<AdminFaq[]> {
  assertCan(admin, "content.read");
  const rows = await query<{ id: string; category: string; question: string; answer: string; sort_order: number; is_active: boolean }>(
    "select id, category, question, answer, sort_order, is_active from faqs order by sort_order, created_at",
  );
  return rows.map((r) => ({ id: r.id, category: r.category, question: r.question, answer: r.answer, sortOrder: r.sort_order, isActive: r.is_active }));
}
