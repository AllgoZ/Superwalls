import "server-only";
import type { Permission } from "@/lib/admin/permissions";
import { toCsv, rupees } from "./csv";
import type { SearchParams } from "./list";
import { listCustomers } from "./queries/customers";
import { listOrders } from "./queries/orders";
import { dailySeries } from "./queries/dashboard";
import { query } from "../db";
import { resolveRange } from "./range";
import { IST_DATE_PAID, REALISED } from "./revenue";
import type { AdminContext } from "./session";

export interface ExportDef {
  /** ALL of these are required (exports leave the system, so the bar is higher than viewing). */
  permissions: Permission[];
  filename: string;
  build: (admin: AdminContext, searchParams: SearchParams) => Promise<string>;
}

const ist = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short", hour12: false });
export const istText = (iso: string | null) => (iso ? ist.format(new Date(iso)) : "");

export const EXPORTS: Record<string, ExportDef> = {
  orders: {
    permissions: ["orders.read", "orders.export"],
    filename: "orders",
    async build(admin, sp) {
      const { rows } = await listOrders(admin, sp, { all: true });
      return toCsv(
        ["Order number", "Placed (IST)", "Customer", "Phone", "Email", "Type", "Items", "Subtotal (INR)", "Delivery (INR)", "Discount (INR)", "Total (INR)", "Payment status", "Order status"],
        rows.map((o) => [o.orderNumber, istText(o.createdAt), o.customerName, o.customerPhone, o.customerEmail, o.customerType, o.itemCount, rupees(o.subtotalPaise), rupees(o.deliveryPaise), rupees(o.discountPaise), rupees(o.totalPaise), o.paymentStatus, o.orderStatus]),
      );
    },
  },
  customers: {
    permissions: ["customers.read", "reports.export"],
    filename: "customers",
    async build(admin, sp) {
      const { rows } = await listCustomers(admin, sp, { all: true });
      return toCsv(
        ["Name", "Email", "Phone", "Type", "Orders", "Net purchase value (INR)", "Last order (IST)", "Registered (IST)"],
        rows.map((c) => [c.name, c.email, c.phone, c.type, c.orderCount, rupees(c.purchaseValuePaise), istText(c.lastOrderAt), istText(c.registeredAt)]),
      );
    },
  },
  sales: {
    permissions: ["reports.view", "reports.export"],
    filename: "sales-by-day",
    async build(_admin, sp) {
      const range = resolveRange(sp);
      const series = await dailySeries(range.from, range.to);
      return toCsv(
        ["Date (IST)", "Net revenue (INR)", "Orders placed"],
        series.map((p) => [p.day, rupees(p.revenuePaise), p.orders]),
      );
    },
  },
  products: {
    permissions: ["reports.view", "reports.export"],
    filename: "product-sales",
    async build(_admin, sp) {
      const range = resolveRange(sp);
      // Every active product, including those that sold nothing, so low performers are visible.
      const rows = await query<{ id: string; name: string; sku: string | null; units: string; revenue: string }>(
        `select p.id, p.name, p.sku, coalesce(s.units, 0) as units, coalesce(s.revenue, 0) as revenue
         from products p left join (
           select i.product_id, sum(i.quantity) as units, sum(i.line_total_paise) as revenue
           from order_items i join orders o on o.id = i.order_id
           where ${REALISED} and ${IST_DATE_PAID} between $1::date and $2::date group by i.product_id
         ) s on s.product_id = p.id where p.archived_at is null order by coalesce(s.units, 0) desc, p.name`,
        [range.from, range.to],
      );
      return toCsv(["Product", "Slug", "SKU", "Units sold", "Revenue (INR)"], rows.map((r) => [r.name, r.id, r.sku, r.units, rupees(r.revenue)]));
    },
  },
  inventory: {
    permissions: ["inventory.read", "reports.export"],
    filename: "inventory",
    async build() {
      const rows = await query<{ id: string; name: string; sku: string | null; stock: number; stock_reserved: number; low_stock_threshold: number; is_active: boolean }>(
        "select id, name, sku, stock, stock_reserved, low_stock_threshold, is_active from products where archived_at is null order by lower(name)",
      );
      return toCsv(
        ["Product", "Slug", "SKU", "On hand", "Reserved", "Available", "Alert at", "Published"],
        rows.map((r) => [r.name, r.id, r.sku, r.stock, r.stock_reserved, Math.max(0, r.stock - r.stock_reserved), r.low_stock_threshold, r.is_active ? "yes" : "no"]),
      );
    },
  },
  adjustments: {
    permissions: ["inventory.read", "reports.export"],
    filename: "stock-movements",
    async build(_admin, sp) {
      const range = resolveRange(sp);
      const rows = await query<{ created_at: string; name: string; kind: string; quantity_before: number; quantity_change: number; quantity_after: number; reason: string; by: string | null }>(
        `select m.created_at, p.name, m.kind, m.quantity_before, m.quantity_change, m.quantity_after, m.reason, a.email as by
         from inventory_movements m join products p on p.id = m.product_id left join admin_members a on a.user_id = m.admin_id
         where (m.created_at at time zone 'Asia/Kolkata')::date between $1::date and $2::date order by m.created_at, m.id`,
        [range.from, range.to],
      );
      return toCsv(["When (IST)", "Product", "Type", "Before", "Change", "After", "Reason", "By"], rows.map((r) => [istText(r.created_at), r.name, r.kind, r.quantity_before, r.quantity_change, r.quantity_after, r.reason, r.by]));
    },
  },
};
