# SuperWalls – Admin CMS

The staff-only panel at **`/admin`**, in the same Next.js app and the same Supabase project as the storefront. It lets the business run day-to-day operations (catalog, orders, stock, promotions, storefront content, reports, team) without editing code or the database. For the storefront and payment design see [Architecture.md](Architecture.md); for status and next steps see [handover.md](handover.md).

> **Scope.** No payment gateway is integrated. The panel shows payment status and references but can never mark an order paid, start a payment, verify one or perform a refund. Orders cancelled after payment are **flagged** `refund_required`; the refund itself belongs to the future gateway integration.

## 1. First-time setup: the first super admin

There is no public admin registration and no admin credential in the source code. The first super admin is provisioned by someone who already has the database connection (`SUPABASE_DB_URL` in `.env.local`).

1. Create a normal account at **`/signup`** with the email that should own the panel, and confirm the email (Supabase sends the link).
2. Run:
   ```bash
   npm run admin:bootstrap -- --email you@example.com --name "Your Name"
   ```
   The script marks that account as an active `super_admin`. If the account doesn't exist yet it stores a 30-day invitation that activates the first time that person signs in with the *Supabase-verified* email. It refuses to run when a super admin already exists (add more staff from **Settings → Team**), unless you pass `--force`.
3. Sign in at **`/admin/login`** with the same email and password.

Afterwards the super admin invites everyone else from **Settings → Team**.

Requirements in the Supabase dashboard: keep **Confirm email ON** (invitations are refused while the project auto-confirms emails, because an attacker could pre-register an invited address).

## 2. Access control

| Layer | What it does |
|---|---|
| Identity | Table `admin_members` (`user_id` → `auth.users`, `role`, `status`). Not `user_metadata`, not a flag a customer can edit. RLS is on with **no** browser grants. |
| Roles → permissions | Table `admin_role_permissions`, re-seeded by migration 0006. TypeScript only names the permissions ([permissions.ts](src/lib/admin/permissions.ts)). |
| Session | `POST /api/admin/auth/login` checks the password with Supabase Auth on the server, then asks `admin_resolve_login`. Tokens live in **httpOnly, SameSite=Lax (Secure in production)** cookies, separate from the storefront session. `src/proxy.ts` refreshes them and sends visitors with no session to the login page. |
| Every request | The token is re-verified with Supabase and the member row re-read, so **suspending or revoking someone takes effect immediately**. |
| Pages | `requireAdmin("<permission>")` first; without it the visitor is redirected to *No access*. |
| Mutations | One dispatcher, `POST /api/admin/op/<name>`: same-origin check → session → permission → rate limit (240/min) → zod validation → run → audit entry → cache invalidation. Unknown ops return 401 to anonymous callers (no enumeration). |
| Database | Stock, order status/cancellation and team changes are SQL functions that **re-check `admin_has_permission`** themselves and are not executable by `anon`/`authenticated`. A trigger prevents removing, demoting or suspending the **last active super admin**; nobody can change their own role or status. |
| Storage | Images are uploaded by `POST /api/admin/upload` with the admin's **own** token. The Storage policy `catalog_staff_*` (via `is_catalog_staff()`) is a second, independent gate. No service-role key exists. |

### Roles

| Role | Permissions |
|---|---|
| **Super admin** | Everything, including Settings, Team and the Activity log |
| **Manager** | Dashboard, catalog, orders (update/export), customers, inventory, promotions, content, reports |
| **Order manager** | Dashboard (order blocks only), orders: read and fulfilment. Sees delivery details only through the orders they process |
| **Content manager** | Dashboard, homepage banners/sections, pages, FAQs, footer; read-only catalog |
| **Inventory manager** | Dashboard, catalog (read), inventory read + adjust |

The dashboard shows a block only when the role may see its data (an order manager never even queries revenue).

## 3. Modules

| Route | What it does |
|---|---|
| `/admin` | KPIs, sales analytics with range selector (today … custom), comparison with the previous period, revenue/orders charts, recent orders, attention list, top products, low stock, new customers, recent activity |
| `/admin/products`, `/new`, `/[id]` | List (search, category/status/stock filters, sort, pagination, bulk actions), create/edit form, image upload with primary + reordering, publish/unpublish/archive/duplicate/feature/delete |
| `/admin/categories` | Create, edit, order, activate; deletion refused while products use the category |
| `/admin/orders`, `/[id]` | Status tabs, search (number/name/phone/email), filters, CSV export; detail with customer, delivery, items, totals, payment attempts, a timeline built only from real records, internal notes, print |
| `/admin/customers`, `/[id]` | Registered customers and guests (guest id = `g-<md5 of email>`), order history, name/phone corrections only |
| `/admin/inventory`, `/history` | Available = on hand − reserved; atomic adjustments with reason; append-only stock ledger; low-stock thresholds |
| `/admin/promotions`, `/[id]` | Percent/fixed coupons, min order, cap, dates, total and per-customer limits, usage history |
| `/admin/content` | Homepage banners (desktop + mobile image, schedule), structured homepage sections (show/hide/order), footer |
| `/admin/pages`, `/[slug]` | About, Contact, Privacy, Terms, Shipping, Refund: Markdown editor with preview, draft/published, SEO |
| `/admin/faqs` | Help-page FAQs |
| `/admin/reports` | Sales, products, orders, customers, inventory; CSV exports |
| `/admin/settings/*` | Store, delivery, contact & support, notifications (preferences only), team |
| `/admin/activity-logs` | Append-only audit trail with filters |

### Order workflow

`placed → confirmed → processing → shipped → out_for_delivery → delivered`, one step at a time, paid orders only. Cancellation is a separate action that needs a reason and is allowed until the parcel ships:

- **Unpaid:** stock hold released, open payment attempt cancelled.
- **Paid:** stock goes back on the shelf (ledger entry), the payment is flagged `refund_required`, and the order stays `paid` until a refund is actually processed by the gateway.
- A cancelled or delivered order is final; repeat cancellation is refused.

### How revenue is counted

Defined once in [revenue.ts](src/lib/server/admin/revenue.ts) and used by the dashboard, reports, customers and exports. Money counts as **realised revenue** only when the order's `payment_status` is `paid` or `partially_refunded` (set by `finalize_payment` from a verified event), the order is **not cancelled**, and `paid_at` is set; its value is `total − refunded`. Pending, failed, cancelled-unpaid and fully refunded orders never count; paid-then-cancelled orders are shown separately as *awaiting refund*. Each order is one row, so a replayed payment event cannot double count. Days are India time (`Asia/Kolkata`); revenue is attributed to the day the payment was verified, orders to the day they were created.

### Coupons and delivery rules at checkout

- The browser sends a coupon **code**, never an amount. `/api/coupons/validate` previews it; `create_checkout_order` evaluates it again under a row lock (so usage limits can't be raced) and stores the discount. Cancelling the order frees the use.
- Delivery fee, free-delivery threshold, minimum order and serviceable PIN codes/cities are read by the server from `store_settings.delivery` on every checkout. The cart shows the same numbers from the public copy of that row.
- The old hard-coded "Demo discount" no longer exists: promotions are coupons.

### Storefront synchronisation

| Change | How it reaches customers |
|---|---|
| Products, prices, stock, publish/unpublish | Storefront reads the table per request, so it is live immediately |
| Banners, sections, pages, FAQs, footer, contact/store/delivery display | Cached readers in [content.ts](src/lib/server/content.ts) tagged `content:*`; each admin op expires its tag at once with `revalidateTag(tag, { expire: 0 })` |
| Delivery charges | Applied by the server at checkout from the database |

The cached readers return only public rows (published / active / visible / within dates) and never touch customer data.

### Content safety

Pages are stored as **Markdown** and rendered with react-markdown: raw HTML is dropped, `javascript:` links removed, images not rendered, external links get `rel="noopener noreferrer nofollow"`. Banner/footer links must be on-site paths, `https:`, `mailto:` or `tel:`. Uploaded images are checked by size and by their real bytes (JPEG/PNG/WebP, ≤ 5 MB). CSV exports neutralise spreadsheet formulas in customer-typed text.

## 4. Audit log

Every sign-in and every sensitive change writes `admin_activity_logs` (actor, action, entity, summary, before/after where useful, IP). The table has no foreign keys and triggers that reject UPDATE, DELETE and TRUNCATE. Keys that look like credentials are redacted before storage, and customer personal data is not copied into entries. Exports are logged too.

## 5. Testing

```bash
npm run dev -- --port 3457            # any free port
BASE_URL=http://localhost:3457 npm run admin:verify
```

`admin:verify` creates temporary staff and customer accounts (`zz-adm-*`), exercises authentication, every role against every module, direct unauthorised API calls, validation, concurrency (parallel stock removals, single-use coupon races), checkout enforcement, storefront synchronisation and revenue correctness, then removes its data. Results are recorded in [handover.md](handover.md).

## 6. Outstanding configuration

- Provision the first super admin (section 1) and keep **Confirm email ON** in Supabase Auth.
- Fill **Settings → Store / Contact / Delivery** with the real details: nothing is invented, so contact fields start empty.
- Replace the demo catalog with real products and images (Products), and publish real **Privacy** and **Terms** pages (Pages).
- The Storage bucket `catalog` and its policies are created by migration 0007. If a migration environment can't write to `storage.*`, create the public bucket manually and add the four `catalog_staff_*` policies from that file.
- Notifications (email/WhatsApp) are **not** connected; the switches only store preferences.
- Refund processing and a payment gateway are future phases; until then `refund_required` orders must be handled outside the system.
