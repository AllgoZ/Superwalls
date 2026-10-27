import "server-only";
import { query } from "../../db";
import { dateParam, likePattern, pageParams, param, type Paged, type SearchParams } from "../list";
import { assertCan, type AdminContext } from "../session";

export interface ActivityRow {
  id: number;
  at: string;
  actor: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip: string | null;
}

export const ACTIVITY_GROUPS: { value: string; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "admin", label: "Sign-ins" },
  { value: "product", label: "Products" },
  { value: "category", label: "Categories" },
  { value: "order", label: "Orders" },
  { value: "stock", label: "Stock" },
  { value: "promotion", label: "Promotions" },
  { value: "banner", label: "Banners" },
  { value: "section", label: "Homepage sections" },
  { value: "page", label: "Pages" },
  { value: "faq", label: "FAQs" },
  { value: "footer", label: "Footer" },
  { value: "settings", label: "Settings" },
  { value: "team", label: "Team & roles" },
  { value: "customer", label: "Customers" },
  { value: "export", label: "Exports" },
  { value: "media", label: "Uploads" },
];

export async function listActivity(admin: AdminContext, sp: SearchParams): Promise<Paged<ActivityRow>> {
  assertCan(admin, "activity.view");
  const { page, pageSize, offset } = pageParams(sp, 50);
  const q = param(sp, "q");
  const group = param(sp, "group");
  const rows = await query<{
    id: string; created_at: string; actor_email: string | null; action: string; entity_type: string | null; entity_id: string | null;
    summary: string; metadata: Record<string, unknown>; ip: string | null; total: string;
  }>(
    `select id, created_at, actor_email, action, entity_type, entity_id, summary, metadata, ip, count(*) over() as total
     from admin_activity_logs
     where ($1::text is null or summary ilike $1 or actor_email ilike $1 or entity_id ilike $1 or action ilike $1)
       and ($2::text is null or action like $2 || '.%')
       and ($3::date is null or (created_at at time zone 'Asia/Kolkata')::date >= $3::date)
       and ($4::date is null or (created_at at time zone 'Asia/Kolkata')::date <= $4::date)
     order by created_at desc, id desc limit $5 offset $6`,
    [q ? likePattern(q) : null, group && /^[a-z]+$/.test(group) ? group : null, dateParam(sp, "from") ?? null, dateParam(sp, "to") ?? null, pageSize, offset],
  );
  return {
    rows: rows.map((r) => ({ id: Number(r.id), at: r.created_at, actor: r.actor_email, action: r.action, entityType: r.entity_type, entityId: r.entity_id, summary: r.summary, metadata: r.metadata ?? {}, ip: r.ip })),
    total: Number(rows[0]?.total ?? 0),
    page,
    pageSize,
  };
}
