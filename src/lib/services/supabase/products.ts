import type { Product } from "@/lib/types";
import { ServiceError } from "../errors";
import type { ProductsRepository } from "../contracts";
import { requireClient } from "./client";

const COLUMNS =
  "id,name,tagline,description,price_paise,compare_at_price_paise,unit,images,stock,stock_reserved,is_demo,is_featured,category_id,seo_title,seo_description";

interface ProductRow {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price_paise: number;
  compare_at_price_paise: number | null;
  unit: string;
  images: { src: string; alt: string }[];
  stock: number;
  stock_reserved: number;
  is_demo: boolean;
  is_featured: boolean;
  category_id: string | null;
  seo_title: string;
  seo_description: string;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    pricePaise: Number(row.price_paise),
    compareAtPricePaise: row.compare_at_price_paise ? Number(row.compare_at_price_paise) : undefined,
    unit: row.unit,
    images: row.images ?? [],
    // What a customer can actually buy right now: on-hand minus units held for unpaid checkouts.
    stock: Math.max(0, row.stock - row.stock_reserved),
    isDemo: row.is_demo,
    isFeatured: row.is_featured,
    categoryId: row.category_id,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

export const supabaseProducts: ProductsRepository = {
  async list() {
    const { data, error } = await requireClient().from("products").select(COLUMNS).eq("is_active", true).order("sort_order");
    if (error) throw new ServiceError("UNKNOWN", "We couldn't load products right now.");
    return (data as ProductRow[]).map(toProduct);
  },

  async getById(id) {
    const { data, error } = await requireClient().from("products").select(COLUMNS).eq("id", id).eq("is_active", true).maybeSingle();
    if (error) throw new ServiceError("UNKNOWN", "We couldn't load this product right now.");
    return data ? toProduct(data as ProductRow) : null;
  },
};
