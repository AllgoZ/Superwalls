import "server-only";
import { z } from "zod";
import { bannerSchema, faqSchema, footerSchema, pageSchema, sectionSchema } from "@/lib/admin/schemas/content";
import { queryOne } from "../../db";
import { ApiError } from "../../errors";
import { assertAllowedImageUrl } from "../media";
import { defineOp } from "../op";

/** Content a person with `content.write` may change. Each op expires the storefront cache tag it affects. */
export const contentOps = [
  defineOp({
    name: "banners.save",
    permission: "content.write",
    input: bannerSchema,
    revalidate: ["content:banners"],
    async run(_ctx, input) {
      for (const url of [input.desktopImageUrl, input.mobileImageUrl]) if (url) assertAllowedImageUrl(url);
      const values = [input.heading, input.subtitle, input.ctaLabel, input.ctaHref, input.desktopImageUrl, input.mobileImageUrl, input.sortOrder, input.isActive, input.startsAt, input.endsAt];
      if (input.id) {
        const row = await queryOne<{ id: string }>(
          `update homepage_banners set heading=$2, subtitle=$3, cta_label=$4, cta_href=$5, desktop_image_url=$6, mobile_image_url=$7,
             sort_order=$8, is_active=$9, starts_at=$10, ends_at=$11 where id=$1 returning id`,
          [input.id, ...values],
        );
        if (!row) throw new ApiError("NOT_FOUND", "That banner no longer exists.");
        return { id: row.id, created: false };
      }
      const row = await queryOne<{ id: string }>(
        `insert into homepage_banners (heading, subtitle, cta_label, cta_href, desktop_image_url, mobile_image_url, sort_order, is_active, starts_at, ends_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        values,
      );
      return { id: row!.id, created: true };
    },
    audit: (input, result) => ({
      action: result.created ? "banner.create" : "banner.update",
      entityType: "banner",
      entityId: result.id,
      summary: `${result.created ? "Created" : "Edited"} banner "${input.heading}"`,
      metadata: { active: input.isActive, startsAt: input.startsAt, endsAt: input.endsAt, sortOrder: input.sortOrder },
    }),
  }),

  defineOp({
    name: "banners.delete",
    permission: "content.write",
    input: z.object({ id: z.uuid() }),
    revalidate: ["content:banners"],
    async run(_ctx, input) {
      const row = await queryOne<{ heading: string }>("delete from homepage_banners where id = $1 returning heading", [input.id]);
      if (!row) throw new ApiError("NOT_FOUND", "That banner no longer exists.");
      return row;
    },
    audit: (input, result) => ({ action: "banner.delete", entityType: "banner", entityId: input.id, summary: `Deleted banner "${result.heading}"` }),
  }),

  defineOp({
    name: "sections.save",
    permission: "content.write",
    input: sectionSchema,
    revalidate: ["content:sections"],
    async run(_ctx, input) {
      if (input.ctaLabel && !input.ctaHref) throw new ApiError("VALIDATION", "A button needs a destination.");
      const row = await queryOne<{ key: string }>(
        `update cms_sections set title=$2, body=$3, cta_label=$4, cta_href=$5, items=$6::jsonb, is_visible=$7, sort_order=$8 where key=$1 returning key`,
        [input.key, input.title, input.body, input.ctaLabel, input.ctaHref, JSON.stringify(input.items), input.isVisible, input.sortOrder],
      );
      if (!row) throw new ApiError("NOT_FOUND", "Unknown section.");
      return { key: row.key };
    },
    audit: (input) => ({ action: "section.update", entityType: "section", entityId: input.key, summary: `Edited homepage section "${input.key}"`, metadata: { visible: input.isVisible, sortOrder: input.sortOrder, items: input.items.length } }),
  }),

  defineOp({
    name: "pages.save",
    permission: "content.write",
    input: pageSchema,
    maxBytes: 90_000,
    revalidate: (input) => ["content:pages", `content:page:${input.slug}`],
    async run({ admin }, input) {
      if (input.status === "published" && input.contentMd.trim().length === 0) {
        throw new ApiError("VALIDATION", "A published page needs some content.");
      }
      await queryOne(
        `insert into cms_pages (slug, title, content_md, seo_title, seo_description, status, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (slug) do update set title=excluded.title, content_md=excluded.content_md, seo_title=excluded.seo_title,
           seo_description=excluded.seo_description, status=excluded.status, updated_by=excluded.updated_by`,
        [input.slug, input.title, input.contentMd, input.seoTitle, input.seoDescription, input.status, admin.userId],
      );
      return { slug: input.slug };
    },
    audit: (input) => ({
      action: input.status === "published" ? "page.publish" : "page.save",
      entityType: "page",
      entityId: input.slug,
      summary: `${input.status === "published" ? "Published" : "Saved draft of"} "${input.title}"`,
      metadata: { status: input.status, length: input.contentMd.length },
    }),
  }),

  defineOp({
    name: "pages.unpublish",
    permission: "content.write",
    input: z.object({ slug: pageSchema.shape.slug }),
    revalidate: (input) => ["content:pages", `content:page:${input.slug}`],
    async run(_ctx, input) {
      const row = await queryOne<{ slug: string }>("update cms_pages set status = 'draft' where slug = $1 returning slug", [input.slug]);
      if (!row) throw new ApiError("NOT_FOUND", "That page hasn't been created yet.");
      return row;
    },
    audit: (input) => ({ action: "page.unpublish", entityType: "page", entityId: input.slug, summary: `Unpublished page "${input.slug}"` }),
  }),

  defineOp({
    name: "faqs.save",
    permission: "content.write",
    input: faqSchema,
    revalidate: ["content:faqs"],
    async run(_ctx, input) {
      if (input.id) {
        const row = await queryOne<{ id: string }>(
          "update faqs set category=$2, question=$3, answer=$4, sort_order=$5, is_active=$6 where id=$1 returning id",
          [input.id, input.category, input.question, input.answer, input.sortOrder, input.isActive],
        );
        if (!row) throw new ApiError("NOT_FOUND", "That FAQ no longer exists.");
        return { id: row.id, created: false };
      }
      const row = await queryOne<{ id: string }>(
        "insert into faqs (category, question, answer, sort_order, is_active) values ($1,$2,$3,$4,$5) returning id",
        [input.category, input.question, input.answer, input.sortOrder, input.isActive],
      );
      return { id: row!.id, created: true };
    },
    audit: (input, result) => ({ action: result.created ? "faq.create" : "faq.update", entityType: "faq", entityId: result.id, summary: `${result.created ? "Created" : "Edited"} FAQ "${input.question.slice(0, 80)}"` }),
  }),

  defineOp({
    name: "faqs.delete",
    permission: "content.write",
    input: z.object({ id: z.uuid() }),
    revalidate: ["content:faqs"],
    async run(_ctx, input) {
      const row = await queryOne<{ question: string }>("delete from faqs where id = $1 returning question", [input.id]);
      if (!row) throw new ApiError("NOT_FOUND", "That FAQ no longer exists.");
      return row;
    },
    audit: (input, result) => ({ action: "faq.delete", entityType: "faq", entityId: input.id, summary: `Deleted FAQ "${result.question.slice(0, 80)}"` }),
  }),

  defineOp({
    name: "footer.save",
    permission: "content.write",
    input: footerSchema,
    revalidate: ["content:settings"],
    async run({ admin }, input) {
      await queryOne(
        `insert into store_settings (key, value, is_public, updated_by) values ('footer', $1::jsonb, true, $2)
         on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by`,
        [JSON.stringify(input), admin.userId],
      );
      return { saved: true };
    },
    audit: () => ({ action: "footer.update", entityType: "settings", entityId: "footer", summary: "Edited the storefront footer" }),
  }),
];
