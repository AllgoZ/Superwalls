# SuperWalls – mobile-first storefront

Storefront for **SuperWalls** (*Cleaner Homes, Happy Life*): a small, app-like shopping experience built with Next.js (App Router, Cache Components), TypeScript, Tailwind CSS v4, shadcn/ui and **Supabase** (Postgres, Auth, Row Level Security).

Two business decisions are final and shape everything below:

- **Checkout:** guest checkout **and** registered-customer checkout.
- **Payment:** **online only**. There is no Cash on Delivery.

> **Status.** The backend (schema, RLS, inventory, payment lifecycle, guest security) is implemented and verified, and a staff **Admin CMS** at `/admin` now manages the catalog, orders, stock, coupons, storefront content, reports and team (see [Admin-CMS.md](Admin-CMS.md)). **No real payment gateway is connected yet**, because the provider has not been chosen. Until one is, checkout says "online payment isn't set up yet" and creates no orders; nothing pretends a payment succeeded. The catalog is still **demo data** until staff replace it in the admin panel.

## Documentation

| Doc | For |
|---|---|
| [README.md](README.md) | Using and running the project (this file) |
| [Architecture.md](Architecture.md) | How it is built: data model, flows, API, security, extension points |
| [Admin-CMS.md](Admin-CMS.md) | The staff admin panel: first-admin setup, roles, modules, revenue rules, testing |
| [handover.md](handover.md) | Current status, verification results, required human actions, next steps, gotchas |
| [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md) | Rules and commands for AI coding agents and contributors |
| [prompts/](prompts) | Original product brief and the Supabase / payment amendment (the spec) |

## Quick start

```bash
npm install
cp .env.example .env.local     # fill in the Supabase values (see "Environment variables")
npm run db:migrate             # create / update the database schema
npm run dev                    # http://localhost:3000
```

Requires Node 20+ (developed on Node 24). Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `db:migrate`, `db:verify`, `api:verify`, `admin:bootstrap`, `admin:verify`.

**Admin panel:** create your own account at `/signup`, confirm the email, then `npm run admin:bootstrap -- --email you@example.com` and sign in at `/admin/login`. Details in [Admin-CMS.md](Admin-CMS.md).

## Environment variables

See [.env.example](.env.example). Server-only values never carry a `NEXT_PUBLIC_` prefix and never reach the browser.

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Publishable (formerly "anon") key. Can only do what RLS allows. |
| `SUPABASE_DB_URL` | **server** | Postgres connection (use the IPv4 *Session pooler* string, URL-encode the password). Used by route handlers and `scripts/db-*.mjs`. |
| `NEXT_PUBLIC_SITE_URL` | public | Origin for payment return URLs. Defaults to the request origin. |
| `PAYMENT_PROVIDER` | server | Selects the gateway adapter. **Empty = payments not configured.** |
| `INVENTORY_RESERVATION_MINUTES` | server | How long stock is held for an unpaid order (default 30, range 5 to 1440). |
| `PAYMENT_SANDBOX_WEBHOOK_SECRET` | server | Local testing only (see "Sandbox gateway"). |
| `CRON_SECRET` | server | Optional bearer secret for the HTTP cron fallback. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_SUPPORT_EMAIL` | public | Fallback support links. The values saved in **Settings → Contact** in the admin panel take priority. |

No service-role key is used anywhere. Privileged work runs on the server's own Postgres connection (below), so there is nothing privileged to leak to the frontend.

## Routes

| Route | Description |
|---|---|
| `/` | Storefront: hero or banners, category filter, featured + product grid (streamed, fresh stock), CMS-managed sections and footer |
| `/products/[id]` | Product details with quantity selector |
| `/cart`, `/checkout`, `/buy` | Cart, whole-cart checkout, and single-product **Buy Now** checkout |
| `/checkout/return?order=SW-…` | **Step 3.** Confirms the payment *with the server*; shows pending / failed (Retry Payment) / success |
| `/orders`, `/orders/[orderNumber]` | Order history and details (RLS for accounts, tracking tokens for guests) |
| `/track` | Guest order lookup (order number + tracking code) |
| `/login`, `/signup`, `/profile` | Auth, saved addresses, profile |
| `/help`, `/privacy`, `/terms` | FAQ (from the admin panel) and legal pages (built-in text until staff publish their own) |
| `/about`, `/contact`, `/shipping`, `/refund-policy` | Pages that exist once staff publish them in the admin panel (404 until then) |
| `/admin/*` | **Staff only.** Dashboard, products, categories, orders, customers, inventory, promotions, content, pages, FAQs, reports, settings, team, activity log. Not linked from the storefront, `noindex`, and protected by its own login |
| `/pay/sandbox` | **Dev-only** fake gateway page (404 outside local testing) |
| `/api/*` | Trusted server operations (see "Backend operations") |

## Customer flows

### Guest checkout (no account)

1. Browse and add to cart.
2. **Step 1:** name, mobile, **email**, full address.
3. **Step 2:** review items, address and the final amount (priced by the server), then pay online.
4. The server creates a *pending-payment* order, holds the stock, opens a gateway session; the browser goes to the gateway.
5. **Step 3:** after the gateway, `/checkout/return` asks the server for the order. Success is shown **only when the server reports the payment as verified**.

The response to a guest checkout contains a one-time **tracking token**. The browser keeps it in `localStorage` and the confirmation page offers a private tracking link (`/track?o=SW-…#t=<token>`). The token travels in the URL *fragment* (never sent to servers or Referer headers) and is POSTed, not put in a query string.

### Registered checkout

Sign up / log in (Supabase Auth, email + password, email verification on). At checkout the name, mobile and saved addresses are prefilled, the email comes from the account, and a saved-address picker is shown. Order history is read straight from Postgres under RLS.

### Account creation after a guest order

The confirmation page offers an optional account. Existing guest orders are attached to the account **only after ownership is proven**, never by email alone:

- the caller holds the order's secret tracking token (this device remembers it), **or**
- the account's email is **verified by Supabase** and equals the order's email. The server reads the verification state from Supabase Auth itself and treats emails as unverified if the project auto-confirms them.

Claiming drops the guest token, so the old tracking link stops working.

## Payment lifecycle

```
cart ─▶ POST /api/checkout ─▶ order(pending_payment) + stock reserved ─▶ payment attempt + gateway session
                                                                              │
                          customer pays on the gateway ◀──────────────────────┘
                                         │
              gateway ──signed webhook──▶ POST /api/payments/webhook/<provider>
                                         │  verify signature over the RAW body
                                         ▼
                          finalize_payment()  (one DB transaction, idempotent per event id)
                          paid   ─▶ order placed, payment paid, stock deducted
                          failed ─▶ payment failed, hold released, order stays retryable
                                         │
        browser lands on /checkout/return ─▶ asks the server ─▶ shows the verified outcome
```

- **Payment status:** `pending, initiated, paid, failed, cancelled, refunded, partially_refunded`.
- **Order (fulfilment) status:** `pending_payment, placed, confirmed, processing, shipped, out_for_delivery, delivered, cancelled`. Kept separate. An order becomes `placed` only inside `finalize_payment`.
- **A redirect or client callback never marks anything paid.** `/api/payments/verify` re-checks the provider signature server-side and then uses the same idempotent finalisation.
- **Failure:** no success page; the order and its cart are preserved; **Retry Payment** reuses the *same order* and opens a new (or resumes the live) attempt. The database allows at most one live attempt per order, so double-clicks and parallel retries cannot create duplicates.
- **Cart:** cleared only on the return page after the server confirms `paid`.
- **Idempotency:** checkout is keyed by a client key derived from basket + contact + address; the same key always resolves to the same order (and a different customer reusing a key is rejected).
- **Late / odd events** are handled in SQL: duplicate webhooks (no-op), wrong amount (never marks paid, flags `refund_required`), payment after expiry (re-reserves stock if possible), sold out meanwhile (order cancelled, `refund_required`), double payment (flagged), `failed` after `paid` (ignored).

### Inventory

`products.stock` is on-hand units and `products.stock_reserved` is units held by unpaid checkouts (available = difference). A hard `CHECK (stock_reserved <= stock)` makes overselling impossible even if application code is wrong. Reservations are taken atomically with the order (`SELECT … FOR UPDATE` in product-id order, so concurrent checkouts cannot deadlock), confirmed on verified payment, and released on failure, cancellation or expiry. Expiry runs every minute via `pg_cron` (migration 0005), lazily on every checkout, and via an optional `GET /api/cron/expire-reservations` (bearer `CRON_SECRET`). Unpaid orders with no hold are cancelled after 24 hours.

## Security model

- **Browser = publishable key + RLS only.** It can read active products, and read/edit *its own* profile and addresses, and read *its own* orders. It cannot insert/update/delete orders, change statuses, read payments, reservations, webhook events or token hashes, or call any SQL function.
- **Server = privileged Postgres connection** (`SUPABASE_DB_URL`) that calls `SECURITY DEFINER` functions whose `EXECUTE` is revoked from `anon`/`authenticated`. Verified TLS with the pinned Supabase root CA ([supabase/certs](supabase/certs)); `server-only` guards the modules.
- **Nothing the client sends is trusted:** prices, totals, delivery, discount, payment status and ownership are all computed or decided on the server; the database re-checks the subtotal against live prices (`PRICE_CHANGED`) and enforces `total = subtotal − discount + delivery`.
- **Guest orders:** a guest order has no owner and no RLS policy matches it, so it is reachable *only* through `get_guest_order(order_number, sha256(token))`. Tokens are 256-bit CSPRNG values; only the SHA-256 is stored; order numbers are not secrets. Tracking is POST-only, rate limited per IP, and "wrong token" is indistinguishable from "no such order". Responses contain no email, token hash or provider ids. A DB constraint enforces `registered ⇒ owner and no token; guest ⇒ token and no owner`.
- **Webhooks:** signature verified over the raw body with a constant-time compare *before* parsing; unknown providers 404; events are recorded in `payment_events` with `UNIQUE (provider, event_id)` so replays are no-ops.
- **Rate limits** (DB-backed, so they hold across serverless instances): checkout, retry, tracking, claim, verify.
- **Auth:** the server never decodes tokens itself; it asks Supabase Auth to verify the bearer token.
- `next build` output was scanned: no DB URL, password, webhook secret or "service_role" string appears in client bundles.

## Backend operations

| Operation | Where |
|---|---|
| Guest + registered order creation, price & stock check, reservation | `POST /api/checkout` → `create_checkout_order` |
| Payment session | `beginPayment()` → gateway adapter `createPaymentSession` → `record_payment_session` |
| Retry | `POST /api/orders/retry-payment` → `begin_payment_attempt` |
| Verification / webhook | `POST /api/payments/verify`, `POST /api/payments/webhook/[provider]` → `finalize_payment` |
| Guest tracking | `POST /api/orders/track` → `get_guest_order` |
| Guest → account | `POST /api/orders/claim` → `claim_guest_orders` |
| Expiry | `expire_reservations` (pg_cron, lazy, `GET /api/cron/expire-reservations`) |

Schema and functions live in [supabase/migrations](supabase/migrations) (`0001` tables, `0002` RLS, `0003` functions, `0004` demo catalog seed, `0005` cron, `0006` admin access + audit log, `0007` catalog / stock ledger / image bucket, `0008` order admin + promotions, `0009` store settings, `0010` storefront content). `npm run db:migrate` applies them all; they are idempotent.

Coupons: `POST /api/coupons/validate` previews a code for a cart; `create_checkout_order` re-validates it under a lock and stores the discount. Delivery rules (fee, free-delivery threshold, minimum order, serviceable PIN codes/cities) come from the database (`store_settings.delivery`, edited in the admin panel), not from code.

## Payment gateway setup (action needed)

The gateway is **not chosen**, so the adapter is not written. The seam is [src/lib/server/payments/](src/lib/server/payments): implement the `PaymentGateway` interface in `types.ts` (`createPaymentSession`, `resumePaymentSession`, `verifyPayment`, `handlePaymentWebhook`, `refundPayment`), register it in `index.ts`, and set `PAYMENT_PROVIDER`. Rules for the adapter: verify the provider's official signature, return a stable `eventId`, use integer paise, read secrets from server-only env vars.

For Razorpay, for example, you would set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; in the Razorpay dashboard create a webhook to `https://<your-domain>/api/payments/webhook/razorpay` for `payment.captured` and `payment.failed`, use the same webhook secret, and have the adapter verify `X-Razorpay-Signature` (HMAC-SHA256 of the raw body). Until an adapter is registered and `PAYMENT_PROVIDER` is set, checkout returns `503 PAYMENT_NOT_CONFIGURED` *before* creating any order or holding any stock.

### Sandbox gateway (local testing only)

`PAYMENT_PROVIDER=sandbox` (with `PAYMENT_SANDBOX_WEBHOOK_SECRET`) enables a fake gateway so the whole flow can be exercised locally: a `/pay/sandbox` page with "success / fail / cancel" buttons that makes the *server* sign and verify a webhook through the same code path as a real provider. It moves no money and is **refused when `NODE_ENV=production`** (verified: a production build returns `503` and 404s the sandbox routes even with the variable set). Do not set it in deployed environments.

## Supabase dashboard settings to confirm

- **Auth → URL Configuration:** set the Site URL and add your redirect URLs (e.g. `https://<domain>/login`) so email-verification links return to the app.
- **Auth → Email:** keep *Confirm email* **on** (the guest-claim-by-verified-email rule depends on it). The built-in mailer is heavily rate limited; configure custom SMTP before launch.
- **Database → Extensions:** `pg_cron` (enabled by migration 0005 when permitted).

## Verification performed

| Command | What it proves |
|---|---|
| `npm run db:verify` | 73 database checks: 12-way oversell race, idempotency, expiry, webhook replay, amount mismatch, late payments, guest isolation, claim rules, RLS and privilege denials for owner / other user / anonymous |
| `npm run api:verify` (needs `npm run dev`) | 100 end-to-end checks against the running app: guest + registered checkout, validation and tampering, token isolation, rate limiting, failed payment → retry → success, forged callbacks, duplicate/forged/tampered webhooks, inventory over HTTP, RLS via PostgREST as a real signed-in user, claims, cron auth |
| `npm run admin:verify` (needs `npm run dev`) | 367 checks on the admin CMS: sign-in and roles, every module, unauthorised API calls, validation, stock and coupon races, checkout enforcement, storefront sync, content sanitisation, revenue correctness |
| `npm run typecheck`, `npm run lint`, `npm run build` | Clean |

Covers the 17 acceptance scenarios. **Not covered:** the browser UI flows were not driven in a real browser (pages were smoke-tested for HTTP 200 and the logic is covered at API level), and the real gateway path cannot be tested until a provider exists.

## Not built yet

(Status, owners of each action and a prioritised plan are in [handover.md](handover.md).)

A real payment adapter and **refunds** (the interface and `refund_required` flags exist; the admin panel flags cancelled paid orders but cannot refund them); transactional emails and WhatsApp messages (notification switches only store preferences); password reset UI; the real catalog, delivery policy and legal pages, which staff now enter through the admin panel.

## Brand assets

`public/brand/` holds crops of the supplied logo (`reference/logo.jpeg`). The source is a 720 px JPEG, so crops are slightly soft at large sizes; supply a vector or transparent PNG when available. Brand colours (blue ≈ `#0654B4`, yellow ≈ `#FCC000`) live in `src/app/globals.css`.
