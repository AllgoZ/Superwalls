import "server-only";
import { query, queryOne } from "../../db";
import { assertCan, type AdminContext } from "../session";

export type PromotionState = "active" | "scheduled" | "expired" | "exhausted" | "inactive";

export interface AdminPromotion {
  id: string;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  percentOff: number | null;
  fixedOffPaise: number | null;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  maxUsesPerCustomer: number | null;
  isActive: boolean;
  uses: number;
  discountGivenPaise: number;
  state: PromotionState;
}

interface Raw {
  id: string; code: string; description: string; discount_type: "percent" | "fixed"; percent_off: number | null; fixed_off_paise: string | null;
  min_order_paise: string; max_discount_paise: string | null; starts_at: string | null; expires_at: string | null; max_uses: number | null;
  max_uses_per_customer: number | null; is_active: boolean; uses: string; given: string;
}

const SELECT = `
  p.*,
  (select count(*) from promotion_redemptions r join orders o on o.id = r.order_id where r.promotion_id = p.id and o.order_status <> 'cancelled') as uses,
  (select coalesce(sum(r.discount_paise), 0) from promotion_redemptions r join orders o on o.id = r.order_id where r.promotion_id = p.id and o.order_status <> 'cancelled') as given`;

function toPromotion(r: Raw): AdminPromotion {
  const uses = Number(r.uses);
  const now = Date.now();
  let state: PromotionState = "active";
  if (!r.is_active) state = "inactive";
  else if (r.expires_at && Date.parse(r.expires_at) <= now) state = "expired";
  else if (r.starts_at && Date.parse(r.starts_at) > now) state = "scheduled";
  else if (r.max_uses !== null && uses >= r.max_uses) state = "exhausted";
  return {
    id: r.id,
    code: r.code,
    description: r.description,
    discountType: r.discount_type,
    percentOff: r.percent_off,
    fixedOffPaise: r.fixed_off_paise === null ? null : Number(r.fixed_off_paise),
    minOrderPaise: Number(r.min_order_paise),
    maxDiscountPaise: r.max_discount_paise === null ? null : Number(r.max_discount_paise),
    startsAt: r.starts_at,
    expiresAt: r.expires_at,
    maxUses: r.max_uses,
    maxUsesPerCustomer: r.max_uses_per_customer,
    isActive: r.is_active,
    uses,
    discountGivenPaise: Number(r.given),
    state,
  };
}

export async function listPromotions(admin: AdminContext): Promise<AdminPromotion[]> {
  assertCan(admin, "promotions.read");
  const rows = await query<Raw>(`select ${SELECT} from promotions p order by p.created_at desc`);
  return rows.map(toPromotion);
}

export interface PromotionDetail extends AdminPromotion {
  redemptions: { id: string; at: string; customer: string; discountPaise: number; orderId: string; orderNumber: string; orderStatus: string }[];
}

export async function getPromotionDetail(admin: AdminContext, id: string): Promise<PromotionDetail | null> {
  assertCan(admin, "promotions.read");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const row = await queryOne<Raw>(`select ${SELECT} from promotions p where p.id = $1`, [id]);
  if (!row) return null;
  // Customer NAME only: usage history doesn't need contact details, and promotion managers may not hold customer access.
  const rows = await query<{ id: string; created_at: string; customer_name: string; discount_paise: string; order_id: string; order_number: string; order_status: string }>(
    `select r.id, r.created_at, o.customer_name, r.discount_paise, o.id as order_id, o.order_number, o.order_status
     from promotion_redemptions r join orders o on o.id = r.order_id
     where r.promotion_id = $1 order by r.created_at desc limit 200`,
    [id],
  );
  return {
    ...toPromotion(row),
    redemptions: rows.map((r) => ({ id: r.id, at: r.created_at, customer: r.customer_name, discountPaise: Number(r.discount_paise), orderId: r.order_id, orderNumber: r.order_number, orderStatus: r.order_status })),
  };
}
