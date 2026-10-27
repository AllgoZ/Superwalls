import { z } from "zod";
import { SLUG_PATTERN } from "../slug";

/** Shared by the admin forms (client) and the operations (server). The server always re-validates. */
const slug = z.string().trim().toLowerCase().min(2, "Slug is too short.").max(60).regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens.");

export const imageSchema = z.object({
  src: z.string().trim().min(1).max(600),
  alt: z.string().trim().max(160).default(""),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the product name.").max(120),
    sku: optionalText(40),
    tagline: z.string().trim().max(160).default(""),
    description: z.string().trim().max(5000).default(""),
    unit: z.string().trim().max(40).default(""),
    categoryId: z.uuid().nullable().default(null),
    pricePaise: z.number().int().min(1, "Enter a selling price.").max(100_000_000),
    compareAtPricePaise: z.number().int().positive().max(100_000_000).nullable().default(null),
    images: z.array(imageSchema).max(10, "At most 10 images."),
    lowStockThreshold: z.number().int().min(0).max(100_000).default(5),
    isActive: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    seoTitle: z.string().trim().max(120).default(""),
    seoDescription: z.string().trim().max(320).default(""),
  })
  .refine((value) => value.compareAtPricePaise === null || value.compareAtPricePaise > value.pricePaise, {
    path: ["compareAtPricePaise"],
    message: "The original price must be higher than the selling price.",
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const productCreateSchema = productInputSchema.safeExtend({
  slug,
  /** Opening stock. Later changes go through Inventory so every movement is recorded. */
  initialStock: z.number().int().min(0).max(1_000_000).default(0),
});

export const productUpdateSchema = productInputSchema.safeExtend({ id: z.string().min(2).max(60) });

export const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter a name.").max(60),
  slug,
  description: z.string().trim().max(500).default(""),
  imageUrl: z.string().trim().max(600).nullish().transform((value) => value || null),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;

export const PRODUCT_STATUSES = ["published", "unpublished", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
