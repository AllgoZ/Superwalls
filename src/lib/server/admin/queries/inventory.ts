import "server-only";
import { query } from "../../db";
import { dateParam, likePattern, pageParams, param, type Paged, type SearchParams } from "../list";
import { assertCan, type AdminContext } from "../session";
import { stockStateOf, type StockState } from "./products";

export interface InventoryOverview {
  activeProducts: number;
  availableUnits: number;
  reservedUnits: number;
  lowStock: number;
  outOfStock: number;
  movementsLast7Days: number;
}

/** Available = physical stock − units reserved by open checkouts. This is the same formula the checkout enforces. */
export async function inventoryOverview(admin: AdminContext): Promise<InventoryOverview> {
  assertCan(admin, "inventory.read");
  const [row] = await query<Record<string, string>>(
    `select
       count(*) filter (where is_active and archived_at is null) as active,
       coalesce(sum(stock - stock_reserved) filter (where is_active and archived_at is null), 0) as available,
       coalesce(sum(stock_reserved) filter (where archived_at is null), 0) as reserved,
       count(*) filter (where is_active and archived_at is null and stock - stock_reserved > 0 and stock - stock_reserved <= low_stock_threshold) as low,
       count(*) filter (where is_active and archived_at is null and stock - stock_reserved <= 0) as out,
       (select count(*) from inventory_movements where created_at > now() - interval '7 days') as moves
     from products`,
  );
  return {
    activeProducts: Number(row?.active ?? 0),
    availableUnits: Number(row?.available ?? 0),
    reservedUnits: Number(row?.reserved ?? 0),
    lowStock: Number(row?.low ?? 0),
    outOfStock: Number(row?.out ?? 0),
    movementsLast7Days: Number(row?.moves ?? 0),
  };
}

export interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  imageSrc: string | null;
  stock: number;
  reserved: number;
  available: number;
  threshold: number;
  state: StockState;
  published: boolean;
}

export async function listInventory(admin: AdminContext, sp: SearchParams): Promise<Paged<InventoryRow>> {
  assertCan(admin, "inventory.read");
  const { page, pageSize, offset } = pageParams(sp);
  const q = param(sp, "q");
  const view = param(sp, "view");
  const rows = await query<{
    id: string; name: string; sku: string | null; image_src: string | null; stock: number; stock_reserved: number;
    low_stock_threshold: number; is_active: boolean; total: string;
  }>(
    `select id, name, sku, images -> 0 ->> 'src' as image_src, stock, stock_reserved, low_stock_threshold, is_active, count(*) over() as total
     from products p
     where archived_at is null
       and ($1::text is null or name ilike $1 or sku ilike $1 or id ilike $1)
       and case $2::text
             when 'low' then stock - stock_reserved > 0 and stock - stock_reserved <= low_stock_threshold
             when 'out' then stock - stock_reserved <= 0
             when 'reserved' then stock_reserved > 0
             when 'attention' then stock - stock_reserved <= low_stock_threshold or stock_reserved > 0
             else true end
     order by (stock - stock_reserved) asc, lower(name) limit $3 offset $4`,
    [q ? likePattern(q) : null, view ?? null, pageSize, offset],
  );
  return {
    rows: rows.map((r) => {
      const available = Math.max(0, r.stock - r.stock_reserved);
      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        imageSrc: r.image_src,
        stock: r.stock,
        reserved: r.stock_reserved,
        available,
        threshold: r.low_stock_threshold,
        state: stockStateOf(available, r.low_stock_threshold),
        published: r.is_active,
      };
    }),
    total: Number(rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}

export interface MovementRow {
  id: number;
  at: string;
  productId: string;
  productName: string;
  kind: string;
  before: number;
  change: number;
  after: number;
  reason: string;
  by: string | null;
  orderId: string | null;
  orderNumber: string | null;
}

export async function listMovements(admin: AdminContext, sp: SearchParams): Promise<Paged<MovementRow>> {
  assertCan(admin, "inventory.read");
  const { page, pageSize, offset } = pageParams(sp);
  const q = param(sp, "q");
  const rows = await query<{
    id: string; created_at: string; product_id: string; product_name: string; kind: string; quantity_before: number; quantity_change: number;
    quantity_after: number; reason: string; by: string | null; order_id: string | null; order_number: string | null; total: string;
  }>(
    `select m.id, m.created_at, m.product_id, p.name as product_name, m.kind, m.quantity_before, m.quantity_change, m.quantity_after, m.reason,
            coalesce(nullif(a.display_name, ''), a.email) as by, m.order_id, o.order_number, count(*) over() as total
     from inventory_movements m
     join products p on p.id = m.product_id
     left join admin_members a on a.user_id = m.admin_id
     left join orders o on o.id = m.order_id
     where ($1::text is null or p.name ilike $1 or p.id ilike $1 or p.sku ilike $1)
       and ($2::text is null or m.kind = $2)
       and ($3::date is null or (m.created_at at time zone 'Asia/Kolkata')::date >= $3::date)
       and ($4::date is null or (m.created_at at time zone 'Asia/Kolkata')::date <= $4::date)
     order by m.created_at desc, m.id desc limit $5 offset $6`,
    [q ? likePattern(q) : null, param(sp, "kind") ?? null, dateParam(sp, "from") ?? null, dateParam(sp, "to") ?? null, pageSize, offset],
  );
  return {
    rows: rows.map((r) => ({
      id: Number(r.id), at: r.created_at, productId: r.product_id, productName: r.product_name, kind: r.kind, before: r.quantity_before,
      change: r.quantity_change, after: r.quantity_after, reason: r.reason, by: r.by, orderId: r.order_id, orderNumber: r.order_number,
    })),
    total: Number(rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}
