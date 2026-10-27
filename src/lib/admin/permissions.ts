/**
 * Admin roles and permission names. Safe on both sides (no secrets).
 *
 * The role -> permission MATRIX is not here: it lives in the database (`admin_role_permissions`, seeded by
 * supabase/migrations/0006) so there is a single source of truth. This file only names things for type safety.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "catalog.read",
  "catalog.write",
  "catalog.delete",
  "orders.read",
  "orders.update",
  "orders.export",
  "customers.read",
  "customers.update",
  "inventory.read",
  "inventory.adjust",
  "promotions.read",
  "promotions.write",
  "content.read",
  "content.write",
  "reports.view",
  "reports.export",
  "settings.manage",
  "team.manage",
  "activity.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["super_admin", "manager", "order_manager", "content_manager", "inventory_manager"] as const;
export type AdminRole = (typeof ROLES)[number];

export const ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super admin",
  manager: "Manager",
  order_manager: "Order manager",
  content_manager: "Content manager",
  inventory_manager: "Inventory manager",
};

export const ROLE_DESCRIPTION: Record<AdminRole, string> = {
  super_admin: "Full access, including team, settings and the audit log.",
  manager: "Catalog, orders, customers, inventory, promotions, content and reports.",
  order_manager: "Processes orders and updates fulfilment status.",
  content_manager: "Banners, homepage sections, pages and FAQs.",
  inventory_manager: "Stock levels, adjustments and inventory history.",
};

export const MEMBER_STATUSES = ["invited", "active", "suspended", "revoked"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** The admin as the UI sees it. Contains no tokens. */
export interface AdminSummary {
  email: string;
  displayName: string;
  role: AdminRole;
  permissions: Permission[];
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** The item is shown when the admin has ANY of these. Real enforcement happens on the server. */
  anyOf: Permission[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: "layout-dashboard", anyOf: ["dashboard.view"] }],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", icon: "shopping-bag", anyOf: ["orders.read"] },
      { label: "Customers", href: "/admin/customers", icon: "users", anyOf: ["customers.read"] },
      { label: "Promotions", href: "/admin/promotions", icon: "ticket-percent", anyOf: ["promotions.read"] },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: "package", anyOf: ["catalog.read"] },
      { label: "Categories", href: "/admin/categories", icon: "tags", anyOf: ["catalog.read"] },
      { label: "Inventory", href: "/admin/inventory", icon: "warehouse", anyOf: ["inventory.read"] },
    ],
  },
  {
    label: "Storefront",
    items: [
      { label: "Banners & sections", href: "/admin/content", icon: "image", anyOf: ["content.read"] },
      { label: "Pages", href: "/admin/pages", icon: "file-text", anyOf: ["content.read"] },
      { label: "FAQs", href: "/admin/faqs", icon: "circle-help", anyOf: ["content.read"] },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Reports", href: "/admin/reports", icon: "chart-column", anyOf: ["reports.view"] },
      { label: "Activity log", href: "/admin/activity-logs", icon: "history", anyOf: ["activity.view"] },
      { label: "Settings", href: "/admin/settings", icon: "settings", anyOf: ["settings.manage"] },
      { label: "Team", href: "/admin/settings/team", icon: "shield-check", anyOf: ["team.manage"] },
    ],
  },
];
