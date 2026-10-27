import "server-only";
import { query, queryOne } from "../../db";
import { likePattern, pageParams, param, type Paged, type SearchParams } from "../list";
import { NET_PAISE, REALISED } from "../revenue";
import { assertCan, type AdminContext } from "../session";
import type { AdminOrderRow } from "./orders";

export interface AdminCustomerRow {
  id: string;
  type: "registered" | "guest";
  name: string;
  email: string;
  phone: string;
  orderCount: number;
  purchaseValuePaise: number;
  lastOrderAt: string | null;
  registeredAt: string | null;
}

interface Raw {
  id: string;
  type: "registered" | "guest";
  name: string | null;
  email: string | null;
  phone: string | null;
  order_count: string;
  purchase_value: string;
  last_order_at: string | null;
  registered_at: string | null;
  total?: string;
}

/**
 * One directory of people: every profile (registered) plus every distinct email that ordered as a guest.
 * A guest's id is `g-<md5 of the lowercased email>`, so a guest has a stable link without storing anything extra.
 * "Purchase value" is NET realised revenue (see revenue.ts): unpaid, cancelled and refunded orders add nothing.
 */
const DIRECTORY = `
  with reg as (
    select p.id::text as id, 'registered'::text as type,
           coalesce(nullif(p.full_name, ''), (select o.customer_name from orders o where o.user_id = p.id order by o.created_at desc limit 1)) as name,
           p.email, coalesce(nullif(p.mobile, ''), (select o.customer_phone from orders o where o.user_id = p.id order by o.created_at desc limit 1)) as phone,
           p.created_at as registered_at, p.id as uid, null::text as gmail
    from profiles p
  ), guests as (
    select 'g-' || md5(lower(o.customer_email)) as id, 'guest'::text as type,
           (array_agg(o.customer_name order by o.created_at desc))[1] as name, lower(o.customer_email) as email,
           (array_agg(o.customer_phone order by o.created_at desc))[1] as phone,
           null::timestamptz as registered_at, null::uuid as uid, lower(o.customer_email) as gmail
    from orders o where o.customer_type = 'guest' group by lower(o.customer_email)
  ), people as (select * from reg union all select * from guests)
  select pe.id, pe.type, pe.name, pe.email, pe.phone, pe.registered_at,
         s.order_count, s.purchase_value, s.last_order_at
  from people pe
  cross join lateral (
    select count(*) as order_count,
           coalesce(sum(case when ${REALISED} then ${NET_PAISE} else 0 end), 0) as purchase_value,
           max(o.created_at) as last_order_at
    from orders o
    where (pe.uid is not null and o.user_id = pe.uid) or (pe.gmail is not null and o.customer_type = 'guest' and lower(o.customer_email) = pe.gmail)
  ) s`;

const toRow = (r: Raw): AdminCustomerRow => ({
  id: r.id,
  type: r.type,
  name: r.name ?? "",
  email: r.email ?? "",
  phone: r.phone ?? "",
  orderCount: Number(r.order_count),
  purchaseValuePaise: Number(r.purchase_value),
  lastOrderAt: r.last_order_at,
  registeredAt: r.registered_at,
});

const SORTS: Record<string, string> = {
  recent: "coalesce(last_order_at, registered_at) desc nulls last, id",
  value: "purchase_value desc, id",
  orders: "order_count desc, id",
  name: "lower(coalesce(name, '')) asc, id",
};

export async function listCustomers(admin: AdminContext, sp: SearchParams, options: { all?: boolean } = {}): Promise<Paged<AdminCustomerRow>> {
  assertCan(admin, "customers.read");
  const { page, pageSize, offset } = pageParams(sp);
  const q = param(sp, "q");
  const type = param(sp, "type");
  const sort = SORTS[param(sp, "sort") ?? ""] ?? SORTS.recent;
  const rows = await query<Raw>(
    `select *, count(*) over() as total from (${DIRECTORY}) d
     where ($1::text is null or name ilike $1 or email ilike $1 or phone ilike $1)
       and ($2::text is null or type = $2)
       and case $3::text when 'repeat' then order_count > 1 when 'buyers' then purchase_value > 0 else true end
     order by ${sort} limit $4 offset $5`,
    [q ? likePattern(q) : null, type ?? null, param(sp, "segment") ?? null, options.all ? 50_000 : pageSize, options.all ? 0 : offset],
  );
  return { rows: rows.map(toRow), total: Number(rows[0]?.total ?? 0), page, pageSize };
}

export interface AdminCustomerDetail extends AdminCustomerRow {
  addresses: { id: string; fullName: string; mobile: string; line1: string; area: string; city: string; state: string; pincode: string; instructions: string; isDefault: boolean }[];
  /** For guests: the delivery address of their latest order, since they have none saved. */
  lastAddress: Record<string, string> | null;
  orders: AdminOrderRow[];
  completedOrders: number;
}

export async function getCustomerDetail(admin: AdminContext, id: string): Promise<AdminCustomerDetail | null> {
  assertCan(admin, "customers.read");
  const isGuest = id.startsWith("g-");
  if (!isGuest && !/^[0-9a-f-]{36}$/i.test(id)) return null;
  if (isGuest && !/^g-[0-9a-f]{32}$/.test(id)) return null;

  const row = await queryOne<Raw>(`select * from (${DIRECTORY}) d where d.id = $1`, [id]);
  if (!row) return null;

  const orderRows = await query<{
    id: string; order_number: string; customer_name: string; customer_email: string; customer_phone: string; customer_type: "guest" | "registered";
    created_at: string; item_count: string; subtotal_paise: string; delivery_paise: string; discount_paise: string; total_paise: string;
    payment_status: string; order_status: string; address_snapshot: Record<string, string>;
  }>(
    `select o.id, o.order_number, o.customer_name, o.customer_email, o.customer_phone, o.customer_type, o.created_at,
            (select coalesce(sum(i.quantity), 0) from order_items i where i.order_id = o.id) as item_count,
            o.subtotal_paise, o.delivery_paise, o.discount_paise, o.total_paise, o.payment_status, o.order_status, o.address_snapshot
     from orders o
     where ($1::boolean and o.customer_type = 'guest' and 'g-' || md5(lower(o.customer_email)) = $2)
        or (not $1::boolean and o.user_id::text = $2)
     order by o.created_at desc limit 200`,
    [isGuest, id],
  );

  const addresses = isGuest
    ? []
    : await query<{ id: string; full_name: string; mobile: string; line1: string; area: string; city: string; state: string; pincode: string; instructions: string; is_default: boolean }>(
        "select id, full_name, mobile, line1, area, city, state, pincode, instructions, is_default from addresses where user_id = $1 order by is_default desc, created_at",
        [id],
      );

  return {
    ...toRow(row),
    addresses: addresses.map((a) => ({ id: a.id, fullName: a.full_name, mobile: a.mobile, line1: a.line1, area: a.area, city: a.city, state: a.state, pincode: a.pincode, instructions: a.instructions, isDefault: a.is_default })),
    lastAddress: orderRows[0]?.address_snapshot ?? null,
    completedOrders: orderRows.filter((o) => o.order_status === "delivered").length,
    orders: orderRows.map((o) => ({
      id: o.id, orderNumber: o.order_number, customerName: o.customer_name, customerEmail: o.customer_email, customerPhone: o.customer_phone,
      customerType: o.customer_type, createdAt: o.created_at, itemCount: Number(o.item_count), subtotalPaise: Number(o.subtotal_paise),
      deliveryPaise: Number(o.delivery_paise), discountPaise: Number(o.discount_paise), totalPaise: Number(o.total_paise),
      paymentStatus: o.payment_status, orderStatus: o.order_status, refundRequired: false,
    })),
  };
}
