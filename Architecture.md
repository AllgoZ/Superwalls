# SuperWalls – Architecture

How the system is put together and why. For setup and day-to-day use see [README.md](README.md); for the staff admin panel see [Admin-CMS.md](Admin-CMS.md); for current status and next steps see [handover.md](handover.md); for agent/contributor rules see [CLAUDE.md](CLAUDE.md).

## 1. Principles

1. **The browser is untrusted.** It holds only the Supabase *publishable* key. Prices, totals, stock, payment status and order ownership are decided on the server or in the database, never taken from the client.
2. **The database is the authority.** Every state change to orders, payments and inventory happens inside a `SECURITY DEFINER` Postgres function that runs in one transaction and enforces its own invariants (CHECK constraints, partial unique indexes, row locks).
3. **No payment is ever assumed.** An order becomes `placed` only inside `finalize_payment`, called from a *verified* provider event. Redirects and client callbacks prove nothing.
4. **Online payment only; guest and registered checkout share one pipeline.** No Cash on Delivery.
5. **Provider-neutral payments.** One `PaymentGateway` interface; the app does not know which gateway is behind it. None is chosen yet, so production reports "payment not configured" rather than simulating success.

## 2. System overview

```
 Browser (React 19, Zustand cart)
   │  publishable key + user JWT                    fetch (JSON)
   ├─────────────── Supabase (PostgREST/RLS) ◀──┐        │
   │   products, own profile/addresses/orders   │        ▼
   │                                            │   Next.js Route Handlers  /api/*
   │                                            │   (server-only modules)
   │                                            │        │ pg Pool, verified TLS (pinned CA)
   │                                            │        ▼
   └──── Supabase Auth (email + password) ──────┴──▶ Postgres
                                                     tables + RLS + SECURITY DEFINER functions + pg_cron
 Payment gateway ──signed webhook──▶ /api/payments/webhook/<provider>
```

- **Next.js 16.4** App Router with Cache Components (`cacheComponents`, `partialPrefetching`), React 19.3, Tailwind v4, shadcn/base-ui, Zustand, react-hook-form + zod 4. Next 16 differs from older versions; read `node_modules/next/dist/docs/` before changing framework-level code (see [AGENTS.md](AGENTS.md)).
- **Two data paths**
  - *Read path (browser → Supabase directly):* products, and a signed-in user's own profile, addresses, orders. Safe because of RLS and column-level grants.
  - *Write path for money/stock (browser → `/api/*` → Postgres):* checkout, retry, verify, tracking, claim. The browser has no write access to orders, payments or stock at all.
- **No service-role key exists or is used.** Privileged work uses the server's own Postgres connection (`SUPABASE_DB_URL`, session pooler, IPv4) and the `SECURITY DEFINER` functions. This avoids a key that could leak to the frontend.

## 3. Repository layout

| Path | Contents |
|---|---|
| `src/app/(main)/` | Pages with the site chrome: home, orders, track, login, signup, profile, help, privacy, terms |
| `src/app/(flow)/` | Focused flow pages (minimal chrome): cart, checkout, `checkout/return`, buy, product detail |
| `src/app/api/` | Route Handlers (trusted server operations), see §6 |
| `src/app/admin/` | Staff admin panel (own layout, `login`, and the protected `(panel)` group), see §12 |
| `src/proxy.ts` | Admin only: refreshes the httpOnly admin session and redirects visitors with no session to the login page |
| `src/app/pay/sandbox/` | Dev-only fake gateway page |
| `src/components/` | `auth`, `cart`, `checkout`, `orders`, `profile`, `shop`, `layout`, `common`, `brand`, `ui` (shadcn) |
| `src/lib/server/` | **Server-only** code: `db.ts` (pg Pool, `withTransaction`), `http.ts` (handler wrapper, rate limit, origin), `auth.ts`, `checkout.ts` (use-cases), `commerce-config.ts` (delivery rules from the DB), `content.ts` (cached public CMS readers), `guest-token.ts`, `errors.ts`, `supabase-ca.ts`, `payments/`, `admin/` (session, op dispatcher, ops, queries, exports) |
| `src/lib/checkout/` | `contract.ts` (zod request/response schemas shared by client and server), `local-state.ts` (guest token refs, pending checkout) |
| `src/lib/services/` | Client-side service layer: `contracts.ts` (interfaces), `repositories.ts` (backend switch), `supabase/*` (RLS reads), `api.ts` + `checkout.ts` (calls to `/api/*`), `mappers.ts`, `unavailable.ts`, `mock/` (demo catalog) |
| `src/lib/{types,validation,config,orders,formatters,commerce,stores,hooks}` | Domain types, zod schemas, config (`commerce.ts`, `env.ts`), status metadata, pricing helpers, cart store, hooks |
| `supabase/migrations/` | `0001` schema, `0002` RLS, `0003` functions, `0004` demo catalog, `0005` pg_cron, `0006` admin access + audit log, `0007` catalog / stock ledger / Storage, `0008` order admin + promotions, `0009` store settings, `0010` storefront content |
| `supabase/certs/` | Pinned Supabase root CA for verified TLS |
| `scripts/` | `db-migrate`, `db-verify` (73 checks), `api-verify` (100 checks), `admin-verify` (+ `.catalog/.orders/.inventory/.cms/.settings` modules), `admin-bootstrap`, `db-url` helper |
| `prompts/` | Original brief and the Supabase/payment amendment (the spec) |

Import rule: anything under `src/lib/server/` starts with `import "server-only"`; client components must never import it. Shared shapes live in `src/lib/checkout/contract.ts`, which is safe on both sides.

## 4. Data model (Postgres)

| Table | Purpose / key constraints |
|---|---|
| `products` | `id text pk`, `price_paise`, `stock`, `stock_reserved`, `sort_order`. `CHECK (stock_reserved <= stock)` makes overselling impossible. Public read. |
| `profiles` | 1:1 with `auth.users` (created by trigger). User may update `full_name`, `mobile` only. |
| `addresses` | Per-user saved addresses; a trigger keeps exactly one default. |
| `orders` | `customer_type` (`guest`/`registered`), `user_id` (restrict), contact, `address_snapshot`, `payment_status`, `order_status`, amounts in paise, `idempotency_key` (unique), `guest_tracking_token_hash`. Constraints: `orders_ownership` (registered ⇒ owner and no token; guest ⇒ token and no owner) and `total = subtotal − discount + delivery`. |
| `order_items`, `order_status_events` | Line snapshots (name/price at purchase) and the status timeline. |
| `payments` | One row per attempt. Partial unique indexes: at most one *live* attempt per order. Stores provider order/payment ids. |
| `payment_events` | Webhook/verification log, `UNIQUE (provider, event_id)` for replay protection. |
| `inventory_reservations` | Per order/product hold with `expires_at`; statuses reserved / confirmed / released / expired. |
| `rate_limits` | Counter buckets keyed by (route, client) for DB-backed limiting that works across serverless instances. |
| `order_number_seq` | Source of `SW-…` order numbers (not secrets). |
| `admin_members`, `admin_role_permissions`, `admin_activity_logs` | Staff identity, the role → permission matrix, and the append-only audit trail (0006). No browser access. |
| `categories`, `inventory_movements` | Product categories (public read of active rows) and the append-only stock ledger (0007). |
| `promotions`, `promotion_redemptions`, `order_notes` | Coupons, one redemption row per order that used one, internal order notes (0008). No browser access. |
| `store_settings` | Key/value business settings; `is_public` rows (store, delivery, contact, footer) are readable by the storefront (0009). |
| `homepage_banners`, `cms_sections`, `cms_pages`, `faqs` | Storefront content (0010); the public may read only published / active / visible rows. |

Catalog columns added in 0007: `category_id`, `sku`, `low_stock_threshold`, `is_featured`, `seo_title`, `seo_description`, `archived_at` (archive = `is_active=false` + `archived_at`; a product's `id` is its permanent URL slug). Order columns added in 0008: `refunded_paise`, `cancel_reason`, `cancelled_at/by`, `promotion_id`, `coupon_code`.

**Statuses** (kept separate on purpose): payment `pending, initiated, paid, failed, cancelled, refunded, partially_refunded`; order `pending_payment, placed, confirmed, processing, shipped, out_for_delivery, delivered, cancelled`.

### Row Level Security (`0002_rls.sql`)

Revoke-all, then grant narrowly: products readable by everyone; profiles select + update of two columns; addresses CRUD on own rows; orders select own, **with column-level grants that exclude the token hash and idempotency key**; items/events readable through the owning order; `payments`, `payment_events`, `inventory_reservations`, `rate_limits` have **no** client access. Guest orders have no owner, so no policy matches them: they are reachable only through `get_guest_order`.

### Functions (`0003_functions.sql`)

All are `SECURITY DEFINER`; a final loop revokes `EXECUTE` from `public`/`anon`/`authenticated`. Only the server's connection can call them.

| Function | Role |
|---|---|
| `create_checkout_order` | Validates items against live prices (`PRICE_CHANGED`), computes totals, creates the order, reserves stock; idempotent per key. |
| `reserve_order_stock` / `release_order_stock` / `confirm_order_stock` | Stock hold lifecycle (lock products in id order → no deadlocks). |
| `begin_payment_attempt` / `record_payment_session` / `fail_payment_attempt` | Retry support and attempt bookkeeping; refreshes the hold. |
| `finalize_payment` | The single place a payment outcome is applied. Idempotent per event; handles duplicate, amount mismatch (flags `refund_required`), late payment (re-reserve), sold-out-after-payment (cancel + flag), double payment, `failed` after `paid`. |
| `get_guest_order`, `claim_guest_orders` | Guest lookup by `(order_number, sha256(token))`; claim to an account after proven ownership. |
| `expire_reservations` | Releases expired holds; cancels unpaid orders after 24 h. Run by pg_cron every minute, lazily on checkout, and via the optional cron route. |
| `check_rate_limit` | Atomic window counter. |
| `set_order_status` | Guarded fulfilment transitions (no caller yet; for the future back-office). |
| `order_json`, `add_order_event` | Serialisation and timeline helpers. |

Lock order everywhere: **products (by id) → orders → payments → reservations**.

## 5. Key flows

### 5.1 Checkout (guest or registered)

1. Client builds a request (items by id/quantity, contact, address) and an **idempotency key** derived from basket + contact + address.
2. `POST /api/checkout`: rate limit per IP → zod validation → optional bearer verification → if no gateway is configured, **503 `PAYMENT_NOT_CONFIGURED` before anything is created** → `create_checkout_order` (order `pending_payment`, stock reserved) → `begin_payment_attempt` → gateway `createPaymentSession` → `record_payment_session`.
3. Response: order summary + `PaymentAction` (where the browser goes) + for guests a one-time tracking token (only its SHA-256 is stored).
4. The cart is **not** cleared here.

### 5.2 Payment confirmation

- **Webhook** (`/api/payments/webhook/[provider]`): read raw body → adapter verifies signature (constant-time) *before* parsing → `finalize_payment` → `payment_events` insert dedupes by `(provider, event_id)`.
- **Browser return** (`/checkout/return?order=…`): the page loads the order (RLS read for accounts, tracking-token lookup for guests) and polls every 2.5 s for up to 90 s while the payment is `pending`/`initiated`. It shows success only when the server-side record says `paid`, then clears the cart. Failed → Retry Payment.
- **`/api/payments/verify`**: for gateways that hand a signed proof back through the browser (e.g. Razorpay's `razorpay_signature`). It re-verifies with the adapter and applies the same idempotent `finalize_payment`; the redirect alone is never trusted.
- **Retry** (`/api/orders/retry-payment`): same order, new or resumed attempt, hold refreshed. Parallel retries cannot create two live attempts (partial unique index).

### 5.3 Guest tracking and claim

- Tracking: `POST /api/orders/track` with order number + token (POST so the token never reaches URLs/logs; the shareable link carries it in the URL *fragment*). Per-IP limit only; wrong token and unknown order are indistinguishable.
- Claim: `POST /api/orders/claim` requires a signed-in user and either the secret token or a Supabase-**verified** email equal to the order's. The server reads `email_confirmed_at` from Supabase Auth and fails closed if the project auto-confirms emails. Claiming discards the token.

### 5.4 Inventory

`available = stock − stock_reserved`. Reserve at checkout, confirm on verified payment (deducts `stock`), release on failure/cancel/expiry. Hold length is `INVENTORY_RESERVATION_MINUTES` (default 30, range 5 to 1440).

## 6. API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/checkout` | POST | Create/resume order and payment session |
| `/api/orders/retry-payment` | POST | Retry for an unpaid order |
| `/api/orders/track` | POST | Guest lookup |
| `/api/orders/claim` | POST | Attach guest orders to the signed-in account |
| `/api/payments/verify` | POST | Server-side check of a browser-returned payment |
| `/api/payments/webhook/[provider]` | POST | Signed provider webhook |
| `/api/payments/sandbox/{session,complete}` | POST | Dev-only fake gateway (404 in production) |
| `/api/cron/expire-reservations` | GET | Optional cron fallback, bearer `CRON_SECRET` |
| `/api/coupons/validate` | POST | Cart preview of a coupon (server prices the cart; rate limited) |
| `/api/admin/auth/login`, `/api/admin/auth/logout` | POST | Staff session (httpOnly cookies) |
| `/api/admin/op/[name]` | POST | The single admin mutation dispatcher (see §11) |
| `/api/admin/upload` | POST | Image upload to Storage with the admin's own token |
| `/api/admin/export/[kind]` | GET | CSV exports (orders, customers, sales, products, inventory, adjustments); permission-gated and audited |

Every handler goes through `handle()` in `src/lib/server/http.ts`: maps `ApiError`/SQL errors to stable `{ error: { code, message } }` JSON, re-throws Next control-flow errors with `unstable_rethrow`, never leaks internals.

## 7. Payment gateway abstraction

`src/lib/server/payments/types.ts` defines `PaymentGateway`: `createPaymentSession`, `resumePaymentSession`, `verifyPayment`, `handlePaymentWebhook`, `refundPayment`, plus `InvalidSignatureError`. `index.ts` registers adapters by `PAYMENT_PROVIDER` and exposes `applyPaymentEvent` (the bridge to `finalize_payment`). Adapter rules: integer paise; official signature verification over the raw body; stable `eventId`; secrets from server-only env.

The **sandbox** adapter (HMAC-SHA256 signed webhooks, local pay page) exists only so the full path can be tested; `isSandboxEnabled()` is false when `NODE_ENV=production`. To add a real provider, see README "Payment gateway setup".

## 8. Client architecture

- **Service layer.** UI never talks to Supabase directly; it uses the `Repositories` interface (`services/contracts.ts`). `repositories.ts` is the single switch: with Supabase configured the real repositories (RLS reads), otherwise the demo catalog plus `unavailable*` stubs (there is no fake account or order store).
- **State.** Cart and Buy-Now are Zustand stores (cart persisted to `localStorage`, guarded against hydration mismatch; guest token refs and the pending-checkout note use `browser-storage.ts`, which is safe when storage is blocked); server data goes through `use-service-query`; session through `use-session` fed by `AuthSync`.
- **Checkout UI** keeps the three-step design: Delivery (guest/registered variants, saved-address picker) → Review (online-only, loading/failed states) → Return/Confirmation (verified outcome only).
- **Rendering.** Cache Components: static shell, with request-time data (`params`, `searchParams`, live stock) read behind `<Suspense>`; the home product grid streams so stock is fresh.

## 9. Security checklist (what is enforced where)

| Concern | Mechanism |
|---|---|
| Privileged credentials never in browser | No service-role key; DB URL is server-only; `server-only` import guard; build output scanned for secrets |
| Verified transport to DB | pg over TLS with pinned Supabase root CA, `rejectUnauthorized` stays on |
| Tamper-proof amounts | Server/DB recompute totals and compare to live prices; DB CHECK on totals |
| No overselling | `CHECK (stock_reserved <= stock)` + ordered row locks |
| Guest privacy | 256-bit token, hash only; no RLS policy matches guests; POST-only lookup; IP rate limit |
| Account takeover via email | Claim needs token or Supabase-verified email; fail-closed on auto-confirm |
| Webhook forgery/replay | Signature before parse, `UNIQUE (provider, event_id)` |
| Double submit / double pay | Idempotency key, one live attempt per order, idempotent `finalize_payment` |
| Abuse | DB-backed rate limits on checkout, retry, track, claim, verify |

## 10. Verification

`npm run db:verify` (73 DB checks incl. a 12-way oversell race and RLS denials), `npm run api:verify` (100 HTTP checks against `npm run dev`), `npm run admin:verify` (367 checks on the admin CMS: sessions and roles, every module, direct unauthorised calls, stock/coupon races, checkout enforcement, storefront synchronisation, content sanitisation, revenue correctness), plus `typecheck`, `lint`, `build`. The database runs on Supabase in Tokyo (`ap-northeast-1`); the pooler allows 15 session connections, so run `db:verify` while the dev server is idle. Browser UI flows have **not** been driven end-to-end in a real browser.

## 11. Admin CMS (summary)

Full guide: [Admin-CMS.md](Admin-CMS.md). The panel is a second trust zone in the same app:

- **Identity & roles.** `admin_members` + `admin_role_permissions` (migration 0006). Sessions are httpOnly cookies set by `/api/admin/auth/login` after Supabase verifies the password and `admin_resolve_login` confirms the account is staff. Every request re-verifies the token and re-reads the member, so suspension is immediate. A trigger protects the last super admin; nobody edits their own access.
- **One mutation path.** `POST /api/admin/op/<name>` runs registered operations (`src/lib/server/admin/ops`): origin → session → permission → rate limit → zod → run → audit → `revalidateTag(tag, { expire: 0 })`. Reads are server components calling query modules that `assertCan`. The DB functions behind stock, order status/cancellation and team changes re-check permission themselves.
- **Money rules.** Revenue is defined once ([revenue.ts](src/lib/server/admin/revenue.ts)): verified-paid, not cancelled, net of refunds. The CMS has no way to set a payment status, start a payment or issue a refund; cancelling a paid order only flags `refund_required`.
- **Stock.** `inventory_movements` is an append-only ledger written by `admin_adjust_stock`, `confirm_order_stock` (sales) and `admin_cancel_order` (restock). Adjustments lock the product row and cannot drop stock below units reserved by open checkouts.
- **Promotions.** `evaluate_promotion` is the single authority, called by the cart preview and again, under a row lock on the coupon, inside `create_checkout_order`; a cancelled order frees its use. Delivery fee / threshold / minimum order / serviceable areas are read from `store_settings.delivery` by `startCheckout`.
- **Content.** `homepage_banners`, `cms_sections`, `cms_pages`, `faqs` and `store_settings` (public rows) feed cached, tagged readers; pages are Markdown rendered without raw HTML.
- **Audit.** `admin_activity_logs` is append-only (triggers reject update/delete/truncate), has no foreign keys, and redacts credential-like keys.
- **Files.** Images go to the public Storage bucket `catalog` using the admin's own token under the `catalog_staff_*` policies. Nothing in the repo holds a service-role key.

## 12. Known limitations and extension points

- **Gateway adapter and refunds** – interface and `refund_required` flags exist; no provider adapter yet.
- **Refund processing** – cancelling a paid order flags it `refund_required`; issuing the refund and setting `refunded_paise` / `refunded` status is the gateway phase.
- **Emails** (confirmation, tracking link) and **password reset** – not built; rely on Supabase Auth mail, which needs custom SMTP before launch.
- **Catalog and pricing policy** – demo products and placeholder delivery/discount in `src/lib/config/commerce.ts` (applied server-side too).
- **Rate limits** are per IP; behind a proxy confirm `clientIp()` reads the right header for the host.
