import "server-only";
import { z } from "zod";
import { categorySchema, productCreateSchema, productUpdateSchema, PRODUCT_STATUSES } from "@/lib/admin/schemas/catalog";
import { query, queryOne, withTransaction, type Tx } from "../../db";
import { ApiError } from "../../errors";
import { assertAllowedImageUrl, assertAllowedImageUrls } from "../media";
import { defineOp } from "../op";

const ids = z.array(z.string().min(2).max(60)).min(1).max(100);

async function assertCategory(tx: Tx | null, categoryId: string | null): Promise<void> {
  if (!categoryId) return;
  const row = await (tx ? tx.queryOne.bind(tx) : queryOne)<{ id: string }>("select id from categories where id = $1", [categoryId]);
  if (!row) throw new ApiError("VALIDATION", "That category no longer exists.");
}

export const catalogOps = [
  defineOp({
    name: "products.create",
    permission: "catalog.write",
    input: productCreateSchema,
    revalidate: ["products"],
    async run(_ctx, input) {
      assertAllowedImageUrls(input.images);
      return withTransaction(async (tx) => {
        await assertCategory(tx, input.categoryId);
        await tx.query(
          `insert into products (
             id, name, tagline, description, unit, price_paise, compare_at_price_paise, images, stock, is_active, is_demo,
             sort_order, category_id, sku, low_stock_threshold, is_featured, seo_title, seo_description)
           values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,false,
             (select coalesce(max(sort_order), 0) + 10 from products),$11,$12,$13,$14,$15,$16)`,
          [
            input.slug, input.name, input.tagline, input.description, input.unit, input.pricePaise, input.compareAtPricePaise,
            JSON.stringify(input.images), input.initialStock, input.isActive, input.categoryId, input.sku,
            input.lowStockThreshold, input.isFeatured, input.seoTitle, input.seoDescription,
          ],
        );
        if (input.initialStock > 0) {
          await tx.query(
            `insert into inventory_movements (product_id, kind, quantity_before, quantity_change, quantity_after, reason)
             values ($1, 'restock', 0, $2, $2, 'Opening stock')`,
            [input.slug, input.initialStock],
          );
        }
        return { id: input.slug };
      });
    },
    audit: (input, result) => ({
      action: "product.create",
      entityType: "product",
      entityId: result.id,
      summary: `Created product "${input.name}"`,
      metadata: { pricePaise: input.pricePaise, published: input.isActive, initialStock: input.initialStock, sku: input.sku },
    }),
  }),

  defineOp({
    name: "products.update",
    permission: "catalog.write",
    input: productUpdateSchema,
    revalidate: ["products"],
    async run(_ctx, input) {
      assertAllowedImageUrls(input.images);
      return withTransaction(async (tx) => {
        await assertCategory(tx, input.categoryId);
        const before = await tx.queryOne<{ name: string; price_paise: string; compare_at_price_paise: string | null; is_active: boolean; category_id: string | null; sku: string | null }>(
          "select name, price_paise, compare_at_price_paise, is_active, category_id, sku from products where id = $1 for update",
          [input.id],
        );
        if (!before) throw new ApiError("NOT_FOUND", "That product no longer exists.");
        await tx.query(
          `update products set name=$2, tagline=$3, description=$4, unit=$5, price_paise=$6, compare_at_price_paise=$7,
             images=$8::jsonb, category_id=$9, sku=$10, low_stock_threshold=$11, is_featured=$12,
             seo_title=$13, seo_description=$14,
             is_active = case when archived_at is not null then false else $15 end
           where id = $1`,
          [
            input.id, input.name, input.tagline, input.description, input.unit, input.pricePaise, input.compareAtPricePaise,
            JSON.stringify(input.images), input.categoryId, input.sku, input.lowStockThreshold, input.isFeatured,
            input.seoTitle, input.seoDescription, input.isActive,
          ],
        );
        return {
          id: input.id,
          before: {
            name: before.name,
            pricePaise: Number(before.price_paise),
            compareAtPricePaise: before.compare_at_price_paise ? Number(before.compare_at_price_paise) : null,
            published: before.is_active,
            categoryId: before.category_id,
            sku: before.sku,
          },
        };
      });
    },
    audit: (input, result) => ({
      action: "product.update",
      entityType: "product",
      entityId: result.id,
      summary: `Edited product "${input.name}"`,
      metadata: {
        before: result.before,
        after: { name: input.name, pricePaise: input.pricePaise, compareAtPricePaise: input.compareAtPricePaise, published: input.isActive, categoryId: input.categoryId, sku: input.sku },
      },
    }),
  }),

  defineOp({
    name: "products.setStatus",
    permission: "catalog.write",
    input: z.object({ ids, status: z.enum(PRODUCT_STATUSES) }),
    revalidate: ["products"],
    async run(_ctx, input) {
      const set =
        input.status === "published"
          ? "is_active = true, archived_at = null"
          : input.status === "unpublished"
            ? "is_active = false, archived_at = null"
            : "is_active = false, archived_at = coalesce(archived_at, now())";
      const rows = await query<{ id: string }>(`update products set ${set} where id = any($1::text[]) returning id`, [input.ids]);
      return { updated: rows.length };
    },
    audit: (input, result) => ({
      action: input.status === "published" ? "product.publish" : input.status === "unpublished" ? "product.unpublish" : "product.archive",
      entityType: "product",
      entityId: input.ids.length === 1 ? input.ids[0] : undefined,
      summary: `${input.status} ${result.updated} product(s)`,
      metadata: { ids: input.ids, status: input.status },
    }),
  }),

  defineOp({
    name: "products.setFeatured",
    permission: "catalog.write",
    input: z.object({ id: z.string().min(2).max(60), featured: z.boolean() }),
    revalidate: ["products"],
    async run(_ctx, input) {
      const row = await queryOne<{ id: string }>("update products set is_featured = $2 where id = $1 returning id", [input.id, input.featured]);
      if (!row) throw new ApiError("NOT_FOUND", "That product no longer exists.");
      return { id: row.id };
    },
    audit: (input) => ({
      action: "product.feature",
      entityType: "product",
      entityId: input.id,
      summary: input.featured ? "Marked as featured" : "Removed from featured",
    }),
  }),

  defineOp({
    name: "products.delete",
    permission: "catalog.delete",
    input: z.object({ ids }),
    revalidate: ["products"],
    async run(_ctx, input) {
      return withTransaction(async (tx) => {
        const used = await tx.query<{ name: string }>(
          `select distinct p.name from products p
           where p.id = any($1::text[])
             and (exists (select 1 from order_items i where i.product_id = p.id)
               or exists (select 1 from inventory_reservations r where r.product_id = p.id))`,
          [input.ids],
        );
        if (used.length > 0) {
          // Historical orders keep their snapshots and reference the product, so it must stay. Archive instead.
          throw new ApiError("CONFLICT", `${used.map((row) => `"${row.name}"`).join(", ")} appear in orders and can't be deleted. Archive instead.`);
        }
        const rows = await tx.query<{ id: string; name: string }>("delete from products where id = any($1::text[]) returning id, name", [input.ids]);
        return { deleted: rows.map((row) => ({ id: row.id, name: row.name })) };
      });
    },
    audit: (_input, result) => ({
      action: "product.delete",
      entityType: "product",
      entityId: result.deleted.length === 1 ? result.deleted[0]!.id : undefined,
      summary: `Deleted ${result.deleted.length} product(s)`,
      metadata: { products: result.deleted },
    }),
  }),

  defineOp({
    name: "products.duplicate",
    permission: "catalog.write",
    input: z.object({ id: z.string().min(2).max(60) }),
    revalidate: ["products"],
    async run(_ctx, input) {
      return withTransaction(async (tx) => {
        const source = await tx.queryOne<{ id: string; name: string }>("select id, name from products where id = $1", [input.id]);
        if (!source) throw new ApiError("NOT_FOUND", "That product no longer exists.");
        let newId = `${source.id}-copy`.slice(0, 60);
        for (let n = 2; await tx.queryOne("select 1 from products where id = $1", [newId]); n++) {
          newId = `${source.id.slice(0, 54)}-copy-${n}`;
        }
        // A copy starts unpublished with no stock, no SKU and not featured: it must be reviewed before it sells.
        await tx.query(
          `insert into products (id, name, tagline, description, unit, price_paise, compare_at_price_paise, images, stock,
             is_active, is_demo, sort_order, category_id, sku, low_stock_threshold, is_featured, seo_title, seo_description)
           select $2, left(name, 111) || ' (copy)', tagline, description, unit, price_paise, compare_at_price_paise, images, 0,
             false, false, (select coalesce(max(sort_order), 0) + 10 from products), category_id, null, low_stock_threshold, false, seo_title, seo_description
           from products where id = $1`,
          [source.id, newId],
        );
        return { id: newId, from: source.id };
      });
    },
    audit: (_input, result) => ({
      action: "product.duplicate",
      entityType: "product",
      entityId: result.id,
      summary: `Duplicated ${result.from}`,
      metadata: { from: result.from },
    }),
  }),

  defineOp({
    name: "categories.save",
    permission: "catalog.write",
    input: categorySchema,
    revalidate: ["categories", "products"],
    async run(_ctx, input) {
      if (input.imageUrl) assertAllowedImageUrl(input.imageUrl);
      if (input.id) {
        const row = await queryOne<{ id: string }>(
          `update categories set name=$2, slug=$3, description=$4, image_url=$5, sort_order=$6, is_active=$7 where id=$1 returning id`,
          [input.id, input.name, input.slug, input.description, input.imageUrl, input.sortOrder, input.isActive],
        );
        if (!row) throw new ApiError("NOT_FOUND", "That category no longer exists.");
        return { id: row.id, created: false };
      }
      const row = await queryOne<{ id: string }>(
        `insert into categories (name, slug, description, image_url, sort_order, is_active) values ($1,$2,$3,$4,$5,$6) returning id`,
        [input.name, input.slug, input.description, input.imageUrl, input.sortOrder, input.isActive],
      );
      return { id: row!.id, created: true };
    },
    audit: (input, result) => ({
      action: result.created ? "category.create" : "category.update",
      entityType: "category",
      entityId: result.id,
      summary: `${result.created ? "Created" : "Edited"} category "${input.name}"`,
      metadata: { slug: input.slug, active: input.isActive, sortOrder: input.sortOrder },
    }),
  }),

  defineOp({
    name: "categories.delete",
    permission: "catalog.delete",
    input: z.object({ id: z.uuid() }),
    revalidate: ["categories", "products"],
    async run(_ctx, input) {
      return withTransaction(async (tx) => {
        const category = await tx.queryOne<{ name: string; n: string }>(
          "select c.name, (select count(*) from products p where p.category_id = c.id) as n from categories c where c.id = $1 for update",
          [input.id],
        );
        if (!category) throw new ApiError("NOT_FOUND", "That category no longer exists.");
        if (Number(category.n) > 0) {
          throw new ApiError("CONFLICT", `${category.n} product(s) still use "${category.name}". Move them to another category first.`);
        }
        await tx.query("delete from categories where id = $1", [input.id]);
        return { name: category.name };
      });
    },
    audit: (input, result) => ({ action: "category.delete", entityType: "category", entityId: input.id, summary: `Deleted category "${result.name}"` }),
  }),
];
