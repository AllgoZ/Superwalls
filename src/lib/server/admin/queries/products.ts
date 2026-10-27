import "server-only";
import { query, queryOne } from "../../db";
import { likePattern, pageParams, param, type Paged, type SearchParams } from "../list";
import { assertCan, type AdminContext } from "../session";

export type StockState = "in_stock" | "low_stock" | "out_of_stock";
export type CatalogStatus = "published" | "unpublished" | "archived";

export interface AdminProductRow {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  pricePaise: number;
  compareAtPricePaise: number | null;
  stock: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  stockState: StockState;
  status: CatalogStatus;
  isFeatured: boolean;
  isDemo: boolean;
  imageSrc: string | null;
  createdAt: string;
}

interface Raw {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  category_name: string | null;
  price_paise: string;
  compare_at_price_paise: string | null;
  stock: number;
  stock_reserved: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  is_demo: boolean;
  archived_at: string | null;
  image_src: string | null;
  created_at: string;
  total?: string;
}

export function stockStateOf(available: number, threshold: number): StockState {
  if (available <= 0) return "out_of_stock";
  return available <= threshold ? "low_stock" : "in_stock";
}

function toRow(row: Raw): AdminProductRow {
  const available = Math.max(0, row.stock - row.stock_reserved);
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    categoryId: row.category_id,
    categoryName: row.category_name,
    pricePaise: Number(row.price_paise),
    compareAtPricePaise: row.compare_at_price_paise ? Number(row.compare_at_price_paise) : null,
    stock: row.stock,
    reserved: row.stock_reserved,
    available,
    lowStockThreshold: row.low_stock_threshold,
    stockState: stockStateOf(available, row.low_stock_threshold),
    status: row.archived_at ? "archived" : row.is_active ? "published" : "unpublished",
    isFeatured: row.is_featured,
    isDemo: row.is_demo,
    imageSrc: row.image_src,
    createdAt: row.created_at,
  };
}

const SORTS: Record<string, string> = {
  created_desc: "p.created_at desc, p.id",
  created_asc: "p.created_at asc, p.id",
  name_asc: "lower(p.name) asc, p.id",
  name_desc: "lower(p.name) desc, p.id",
  price_asc: "p.price_paise asc, p.id",
  price_desc: "p.price_paise desc, p.id",
  stock_asc: "(p.stock - p.stock_reserved) asc, p.id",
  stock_desc: "(p.stock - p.stock_reserved) desc, p.id",
};

const SELECT = `
  p.id, p.name, p.sku, p.category_id, c.name as category_name, p.price_paise, p.compare_at_price_paise,
  p.stock, p.stock_reserved, p.low_stock_threshold, p.is_active, p.is_featured, p.is_demo, p.archived_at,
  p.images -> 0 ->> 'src' as image_src, p.created_at`;

export async function listProducts(admin: AdminContext, searchParams: SearchParams): Promise<Paged<AdminProductRow>> {
  assertCan(admin, "catalog.read");
  const { page, pageSize, offset } = pageParams(searchParams);
  const q = param(searchParams, "q");
  const category = param(searchParams, "category");
  const status = param(searchParams, "status") ?? "";
  const stock = param(searchParams, "stock");
  const sort = SORTS[param(searchParams, "sort") ?? ""] ?? SORTS.created_desc;

  const rows = await query<Raw>(
    `select ${SELECT}, count(*) over() as total
     from products p left join categories c on c.id = p.category_id
     where ($1::text is null or p.name ilike $1 or p.sku ilike $1 or p.id ilike $1)
       and ($2::text is null or ($2 = 'none' and p.category_id is null) or p.category_id::text = $2)
       and case $3::text
             when 'published'   then p.is_active and p.archived_at is null
             when 'unpublished' then not p.is_active and p.archived_at is null
             when 'archived'    then p.archived_at is not null
             when 'all'         then true
             else p.archived_at is null end
       and case $4::text
             when 'out' then p.stock - p.stock_reserved <= 0
             when 'low' then p.stock - p.stock_reserved > 0 and p.stock - p.stock_reserved <= p.low_stock_threshold
             when 'in'  then p.stock - p.stock_reserved > p.low_stock_threshold
             else true end
     order by ${sort}
     limit $5 offset $6`,
    [q ? likePattern(q) : null, category ?? null, status, stock ?? null, pageSize, offset],
  );
  return { rows: rows.map(toRow), total: Number(rows[0]?.total ?? 0), page, pageSize };
}

export interface AdminProductDetail extends AdminProductRow {
  tagline: string;
  description: string;
  unit: string;
  images: { src: string; alt: string }[];
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}

export async function getProductDetail(admin: AdminContext, id: string): Promise<AdminProductDetail | null> {
  assertCan(admin, "catalog.read");
  const row = await queryOne<Raw & { tagline: string; description: string; unit: string; images: { src: string; alt: string }[]; seo_title: string; seo_description: string; updated_at: string }>(
    `select ${SELECT}, p.tagline, p.description, p.unit, p.images, p.seo_title, p.seo_description, p.updated_at
     from products p left join categories c on c.id = p.category_id where p.id = $1`,
    [id],
  );
  if (!row) return null;
  return {
    ...toRow(row),
    tagline: row.tagline,
    description: row.description,
    unit: row.unit,
    images: Array.isArray(row.images) ? row.images : [],
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    updatedAt: row.updated_at,
  };
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export async function listCategories(admin: AdminContext): Promise<AdminCategory[]> {
  assertCan(admin, "catalog.read");
  const rows = await query<{ id: string; name: string; slug: string; description: string; image_url: string | null; sort_order: number; is_active: boolean; product_count: string }>(
    `select c.id, c.name, c.slug, c.description, c.image_url, c.sort_order, c.is_active, count(p.id) as product_count
     from categories c left join products p on p.category_id = c.id
     group by c.id order by c.sort_order, lower(c.name)`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    productCount: Number(row.product_count),
  }));
}
