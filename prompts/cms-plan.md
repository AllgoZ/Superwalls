# SuperWalls Admin CMS – implementation plan

Source brief: [cms.md](cms.md). Rules: [../CLAUDE.md](../CLAUDE.md). Status of each stage is kept in [../handover.md](../handover.md).

## Phase A findings (what already exists)

- Next.js 16.4 (Cache Components), React 19.3, Tailwind v4, shadcn **base-nova** on `@base-ui/react`. UI primitives present: accordion, badge, button, checkbox, input, label, radio-group, sheet, skeleton, sonner, textarea. **Missing for an admin:** dialog/alert-dialog, select, dropdown-menu, tabs, switch, table, tooltip, popover.
- DB: `products` (text id, `images` jsonb, `stock`, `stock_reserved`, `is_active`), `orders` + `order_items` + `order_status_events`, `payments`, `inventory_reservations`, `profiles`, `addresses`. No categories, SKU, roles, audit log, stock movement log, promotions or CMS tables.
- Server authority = server-only `pg` pool (`SUPABASE_DB_URL`) + `SECURITY DEFINER` functions; **no service-role key**. Browser reads the catalog through RLS with the publishable key.
- Customer auth: Supabase JS session in `localStorage`, verified server-side by calling `/auth/v1/user` with the bearer token.
- Delivery/discount policy is a hard-coded placeholder (`src/lib/config/commerce.ts`) used by both the cart UI and `startCheckout`.
- `set_order_status` exists with no caller; `confirm_order_stock` deducts stock without any movement log.

## Architecture decisions

1. **Admin identity** – table `admin_members` (user_id → `auth.users`, role, status `invited|active|suspended|revoked`). Never `user_metadata`. A role→permission matrix lives in the table `admin_role_permissions` (single source of truth, seeded by migration); TypeScript only holds the typed list of permission names.
2. **Admin session** – separate from the storefront session. `POST /api/admin/auth/login` exchanges email+password with Supabase Auth on the server, checks `admin_members`, and stores the tokens in **httpOnly, SameSite=Lax, Secure(prod)** cookies. `proxy.ts` refreshes an expiring access token for `/admin/*` and `/api/admin/*`. Every request re-verifies the token with Supabase and re-reads the member row, so suspension takes effect immediately.
3. **Authorization is enforced three times**: (a) server pages call `requireAdmin(permission)`; (b) every mutation goes through one dispatcher `POST /api/admin/op/<name>` that checks origin, rate limit, permission and a zod schema before running; (c) the database functions that matter (stock, order status, role changes) re-check invariants themselves. Hiding links is only cosmetic.
4. **Mutations = operation registry** (`src/lib/server/admin/ops/*`): `defineOp({ name, permission, input, run, audit, revalidate })`. Adding a feature = adding an entry; the dispatcher gives auth, audit and cache revalidation uniformly, and `api-verify` can test any op with any role.
5. **Reads** – admin pages are server components calling query modules in `src/lib/server/admin/*` (parameterised SQL, aggregation in the database, pagination in SQL). Filters live in the URL.
6. **Images** – public Storage bucket `catalog`. `POST /api/admin/upload` validates size + magic bytes, then uploads **with the admin's own JWT**; a Storage RLS policy (`is_catalog_admin()`) is what allows the write. No service-role key.
7. **Storefront sync** – public CMS tables have RLS "public may read published rows"; storefront readers are `'use cache'` + `cacheTag`, ops call `revalidateTag(tag, { expire: 0 })`. Products stay per-request (live stock). Delivery/coupon rules are read by the **server** in `startCheckout`; the cart UI fetches the same public config.
8. **Revenue definition** (one SQL fragment reused everywhere): realised revenue = orders with `payment_status in (paid, partially_refunded, refunded)`, minus `refunded_paise`, excluding orders flagged `refund_required` that were cancelled. Pending/failed/cancelled-unpaid never count. One row per order, so duplicate payment events cannot double count.
9. **Product delete/archive** – `order_items.product_id` FK stays; delete only when unreferenced, otherwise archive (`archived_at`, `is_active=false`). Product **slug = id**, fixed at creation (changing it would break carts, orders and links).
10. **No payment actions** – payment status is display-only; there is no code path in the CMS that sets `paid`, creates sessions or refunds.

## Roles → permissions

| Role | Permissions |
|---|---|
| super_admin | everything |
| manager | dashboard, catalog read/write, orders read/update/export, customers read, inventory read/adjust, promotions read/write, content, reports view/export |
| order_manager | dashboard, orders read/update (customer/delivery data only through orders) |
| content_manager | dashboard, content read/write, catalog read |
| inventory_manager | dashboard, catalog read, inventory read/adjust |

Security-only areas (team, store/delivery settings, audit log) are `team.manage`, `settings.manage`, `activity.view` – super_admin only unless explicitly added.

## Stages

| # | Scope | Migration | Done when |
|---|---|---|---|
| 1 | Foundations: deps, UI primitives, `admin_members`/roles/audit log, bootstrap script, session + proxy, op dispatcher, login, shell (sidebar, topbar, breadcrumbs, profile menu, mobile drawer) | 0006 | Login works; unauthenticated/customer/suspended blocked; build clean |
| 2 | Categories, products (list/new/edit, images, publish/unpublish/archive/delete/duplicate/feature) | 0007 | Create a product with images; storefront shows it |
| 3 | Orders (list, detail, status workflow, cancel, notes, print, CSV), customers, dashboard | 0008 | Real orders visible; transitions guarded; dashboard from SQL aggregates |
| 4 | Inventory (overview, adjust, history), promotions + storefront coupon + delivery config in checkout | 0009 | Atomic stock adjust w/ movement log; coupon validated server-side |
| 5 | CMS: banners, sections, pages (sanitised Markdown), FAQs, footer | 0010 | Edits appear on the storefront without code |
| 6 | Settings (store, delivery, contact, notifications), reports + CSV, team management, activity log | – | Super-admin only areas enforced |
| 7 | Verification (db-verify + api-verify additions), README/Architecture/handover, super-admin provisioning guide | – | typecheck, lint, build, db:verify, api:verify all green and honestly reported |

Out of scope (per brief): any Razorpay/payment-session/refund processing, WhatsApp/email sending, public admin registration, impersonating customers, password changes for customers.
