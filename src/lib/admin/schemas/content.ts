import { z } from "zod";

/** Links must be on-site paths, in-page anchors, https URLs, tel: or mailto: (never javascript: or data:). */
export const SAFE_HREF = /^(\/|#|https:\/\/|mailto:|tel:)[^\s]*$/;
const href = z.string().trim().max(300).regex(SAFE_HREF, "Use a path like /help, an https:// link, mailto: or tel:.");
const optionalHref = z.union([z.literal(""), href]);
const imageUrl = z.string().trim().max(600).nullish().transform((value) => value || null);

export const bannerSchema = z
  .object({
    id: z.uuid().optional(),
    heading: z.string().trim().min(1, "Enter a heading.").max(120),
    subtitle: z.string().trim().max(240).default(""),
    ctaLabel: z.string().trim().max(40).default(""),
    ctaHref: optionalHref.default(""),
    desktopImageUrl: imageUrl,
    mobileImageUrl: imageUrl,
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isActive: z.boolean().default(true),
    startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
  })
  .refine((value) => !value.startsAt || !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt), { path: ["endsAt"], message: "The end must be after the start." })
  .refine((value) => !value.ctaLabel || value.ctaHref, { path: ["ctaHref"], message: "A button needs a destination." });
export type BannerInput = z.infer<typeof bannerSchema>;

export const SECTION_KEYS = ["hero", "promo_strip", "featured_products", "brand_intro", "why_choose", "benefits", "support"] as const;
export type SectionKeyName = (typeof SECTION_KEYS)[number];

export const SECTION_META: Record<SectionKeyName, { label: string; description: string; fields: ("title" | "body" | "cta" | "items")[] }> = {
  hero: { label: "Hero", description: "Headline block at the top (used when there are no active banners).", fields: ["title", "body", "cta"] },
  promo_strip: { label: "Promotional strip", description: "One highlighted line. {threshold} becomes the free-delivery amount.", fields: ["title", "body"] },
  featured_products: { label: "Featured products", description: "Shows products marked Featured. Choose which in each product.", fields: ["title"] },
  brand_intro: { label: "Brand introduction", description: "A short paragraph about SuperWalls.", fields: ["title", "body"] },
  why_choose: { label: "Why choose SuperWalls", description: "Up to 8 short points.", fields: ["title", "items"] },
  benefits: { label: "Customer benefits", description: "Up to 8 short points.", fields: ["title", "items"] },
  support: { label: "Contact / support", description: "A help call-out with a button.", fields: ["title", "body", "cta"] },
};

export const sectionSchema = z.object({
  key: z.enum(SECTION_KEYS),
  title: z.string().trim().max(120).default(""),
  body: z.string().trim().max(1000).default(""),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaHref: optionalHref.default(""),
  items: z.array(z.object({ title: z.string().trim().min(1, "Each point needs a heading.").max(80), text: z.string().trim().max(200).default("") })).max(8),
  isVisible: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});
export type SectionInput = z.infer<typeof sectionSchema>;

export const PAGE_SLUGS = ["about", "contact", "privacy", "terms", "shipping", "refund"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export const PAGE_META: Record<PageSlug, { label: string; path: string }> = {
  about: { label: "About Us", path: "/about" },
  contact: { label: "Contact Us", path: "/contact" },
  privacy: { label: "Privacy Policy", path: "/privacy" },
  terms: { label: "Terms and Conditions", path: "/terms" },
  shipping: { label: "Shipping Policy", path: "/shipping" },
  refund: { label: "Refund and Cancellation Policy", path: "/refund-policy" },
};

export const pageSchema = z.object({
  slug: z.enum(PAGE_SLUGS),
  title: z.string().trim().min(1, "Enter a page title.").max(120),
  contentMd: z.string().max(60_000),
  seoTitle: z.string().trim().max(120).default(""),
  seoDescription: z.string().trim().max(320).default(""),
  status: z.enum(["draft", "published"]),
});
export type PageInput = z.infer<typeof pageSchema>;

export const faqSchema = z.object({
  id: z.uuid().optional(),
  category: z.string().trim().min(1, "Enter a category.").max(40),
  question: z.string().trim().min(3, "Enter the question.").max(200),
  answer: z.string().trim().min(1, "Enter the answer.").max(2000),
  sortOrder: z.number().int().min(0).max(10_000),
  isActive: z.boolean(),
});
export type FaqInput = z.infer<typeof faqSchema>;

const link = z.object({ label: z.string().trim().min(1).max(40), href });
export const footerSchema = z.object({
  description: z.string().trim().max(300),
  usefulLinks: z.array(link).max(10),
  policyLinks: z.array(link).max(10),
  socialLinks: z.array(z.object({ label: z.string().trim().min(1).max(30), href: z.string().trim().max(300).regex(/^https:\/\/[^\s]+$/, "Social links must start with https://") })).max(8),
  copyright: z.string().trim().max(160),
});
export type FooterSettings = z.infer<typeof footerSchema>;

export const DEFAULT_FOOTER: FooterSettings = {
  description: "",
  usefulLinks: [
    { label: "My Orders", href: "/orders" },
    { label: "Profile", href: "/profile" },
    { label: "Help & Support", href: "/help" },
    { label: "Cart", href: "/cart" },
  ],
  policyLinks: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms & Conditions", href: "/terms" },
  ],
  socialLinks: [],
  copyright: "",
};
