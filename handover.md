# SuperWalls – Handover

**Last updated:** 2026-10-27 · **Branch:** `main` · **Commits:** initial commit + the Admin CMS / storefront-content work (committed and pushed to `origin/main`, see `git log`). No secrets are in tracked files.

Read order for a newcomer: [README.md](README.md) → [Architecture.md](Architecture.md) → [Admin-CMS.md](Admin-CMS.md) → this file. Agent rules: [CLAUDE.md](CLAUDE.md). The original spec is [prompts/supabase_integration.md](prompts/supabase_integration.md); the admin brief is [prompts/cms.md](prompts/cms.md) and its plan [prompts/cms-plan.md](prompts/cms-plan.md).

## 1. Where things stand

| Area | State |
|---|---|
| Storefront UI (home, product, cart, buy-now, help, legal) | Done. Homepage banners/sections/footer, category filter, FAQs, contact details and legal pages are now **managed from the admin panel** |
| Supabase schema, RLS, SQL functions, pg_cron | **Done and applied** (migrations 0001–0010) |
| Guest + registered checkout (3-step design kept) | Done. Now also: coupon box in the review step, delivery rules from the database |
| Payment lifecycle, inventory reservation, guest tracking/claim, auth | Done, tested with the sandbox gateway |
| **Admin CMS** (`/admin`) | **Built**: login + roles, dashboard, products, categories, orders, customers, inventory, promotions, banners/sections/footer, pages, FAQs, reports + CSV, settings, team, activity log. See [Admin-CMS.md](Admin-CMS.md) |
| **Real payment gateway adapter** | **Not built** – provider not chosen |
| **Refunds** | **Not built.** Cancelling a paid order restocks it and flags the payment `refund_required`; nothing is refunded or claimed as refunded |
| Transactional emails / WhatsApp sending, password reset UI | **Not built** (notification switches only store preferences) |
| Real catalog, prices, legal text, contact details | **Placeholders** until staff enter them in the admin panel (contact fields start empty on purpose) |
| Browser end-to-end testing of the UI (storefront **and** admin) | **Not done.** Pages were verified over HTTP (status, rendered content, permissions, behaviour), not driven or screenshotted in a real browser, and mobile/tablet layouts were not eyeballed |

**Practical consequence today:** in a production build, checkout returns `503 PAYMENT_NOT_CONFIGURED` and creates nothing. Locally, `PAYMENT_PROVIDER=sandbox` enables the fake gateway so the whole flow can be exercised.

## 2. Verification (2026-10-27)

All run against the **new Supabase project (Tokyo, ap-northeast-1)** with a clean database built only from `npm run db:migrate`:

| Command | Result |
|---|---|
| `npm run db:migrate` | All 10 migrations applied (7 s) |
| `npm run db:verify` | **73 passed, 0 failed** (storefront regression: oversell race, idempotency, payments, guest isolation, RLS) |
| `npm run api:verify` | **100 passed, 0 failed** (storefront API regression, including checkout with DB-driven delivery rules) |
| `npm run admin:verify` | **367 passed, 0 failed**: authentication, every role against every module, direct unauthorised calls, validation, concurrency (parallel stock removals, single-use coupon race), checkout enforcement, storefront sync, content sanitisation, revenue correctness |
| `npm run typecheck`, `npm run lint`, `npm run build` | Clean |
| CMS module on the **production server** (`next start`) | 106 passed (cache invalidation behaves the same as in dev) |
| Production-mode checks | Sandbox gateway 404, no DB URL / password / service-role string in client bundles |

Notes: the pooler of the new project allows 15 connections, so run `db:verify` (it opens a dozen for its race test) while the dev server is idle or stopped. Earlier runs against the Sydney project took ~40 minutes because of network latency; on Tokyo the full chain takes minutes. Re-run these before relying on this table if more changes have landed.

## 3. Environment and accounts

- **Supabase project** (region ap-northeast-1, Tokyo; the earlier Sydney project was replaced). Values are in git-ignored `.env.local`; `.env.example` is a credential-free template. **No new environment variable was added by the admin CMS.**
- **Server DB access** is `SUPABASE_DB_URL` via the **IPv4 session pooler**. TLS is verified against the pinned CA in `supabase/certs/`.
- **There is no usable service-role key** and the CMS deliberately does not need one: admin identity is a database table, uploads use the admin's own token under Storage RLS, and all privileged writes run on the server's Postgres connection.
- `.env.local` also sets `PAYMENT_PROVIDER=sandbox`, `PAYMENT_SANDBOX_WEBHOOK_SECRET` and `CRON_SECRET` for local testing. **Do not copy `PAYMENT_PROVIDER=sandbox` into deployed environments.**
- Ports 3000 and 3100 on this machine are used by other projects; run this app with `npm run dev -- --port 3457` and pass `BASE_URL=http://localhost:3457` to the verify scripts.

## 4. Actions required by a human

1. **First super admin: done.** `superwallsofficial@gmail.com` was created (email confirmed) and made `super_admin` in the new database. **Change its password** (it was shared in a chat): Supabase → Authentication → Users → reset password. Further staff: they sign up at `/signup`, then a super admin invites them under Settings → Team. To provision an admin on a fresh database see [Admin-CMS.md](Admin-CMS.md) §1.
2. **Reset the new database password** (Supabase → Project Settings → Database) because the current one was visible in an AI session while setting up. Then update `SUPABASE_DB_URL` in `.env.local` (URL-encode special characters).
3. **Choose the payment gateway** and supply credentials (§6).
4. **Supabase dashboard:** Auth → URL Configuration (Site URL + redirect URLs); keep **Confirm email ON** (guest-claim-by-verified-email and admin invitations both depend on it); configure **custom SMTP**; confirm `pg_cron` and job `superwalls-expire-reservations`.
5. In the admin panel: enter the real **store, contact, delivery** settings, replace the demo products and publish real **Privacy / Terms / Shipping / Refund** pages. Set the WhatsApp number in Settings → Contact (or `NEXT_PUBLIC_WHATSAPP_NUMBER`).
6. Review the pushed work and open a PR/branch flow if you want review before further changes (it was committed straight to `main` on request).

## 5. Decisions that are settled (do not relitigate without the owner)

- Guest **and** registered checkout; **online payment only**, no COD.
- Money is integer paise; payment status and order status are separate vocabularies.
- Server authority via `SECURITY DEFINER` functions on a server-only Postgres connection; the browser has publishable key + RLS only.
- Guest orders are never reachable by RLS or by bare email; tokens are 256-bit, hash-only, POST-only lookup, token in URL fragment.
- No production payment simulation; the sandbox is dev-only and hard-disabled in production.
- The 3-step checkout UI stays; no frontend rebuild.
- **Admin:** staff identity lives only in `admin_members`; roles map to permissions in `admin_role_permissions`; no public admin sign-up; every page and mutation re-checks on the server; the CMS can never set `paid`, start a payment or claim a refund.
- **Revenue** = verified-paid, not cancelled, net of refunds, attributed to `paid_at` (India time); defined once in `src/lib/server/admin/revenue.ts`.
- A product's `id` is its permanent URL slug (carts, orders and links depend on it); products referenced by orders are archived, never deleted.
- A coupon **replaces** any automatic discount. The old hard-coded "Demo discount" (5% over ₹799) was removed because it was a fake promotion; promotions are coupons now.
- Fulfilment moves one step at a time and only for paid orders; cancellation needs a reason and is allowed until the parcel ships; a cancelled or delivered order is final.
- Uploaded images are never deleted from Storage (order snapshots and duplicates may still reference them).

## 6. Recommended next steps (in order)

1. **First-run acceptance in a real browser:** sign in as super admin, create a category and product with images, publish, check the storefront; place a sandbox order as guest and as a customer; walk it through fulfilment; cancel one; edit a banner, FAQ and a policy page; create a coupon and use it. Check phone and tablet widths for both storefront and admin (not yet eyeballed).
2. **Implement the real gateway adapter** in `src/lib/server/payments/` (interface in `types.ts`, register in `index.ts`): sessions, verification, signed webhooks over the raw body, `refundPayment`. Extend `scripts/api-verify.mjs` with the provider's signed fixtures. Test in the provider's test mode first.
3. **Refunds:** a flow that consumes `refund_required` orders (surfaced in the dashboard, notification bell and order list), calls `refundPayment`, sets `refunded_paise` and moves the payment to `refunded` / `partially_refunded`. Revenue already subtracts `refunded_paise`.
4. **Emails / WhatsApp:** order confirmation with the private tracking link, shipping updates, password reset UI, custom SMTP. The notification switches and the audit log are ready for it.
5. **Ops:** deploy env vars, `NEXT_PUBLIC_SITE_URL` (also used by the admin same-origin check), verify `clientIp()` behind the host's proxy, schedule `/api/cron/expire-reservations` if needed, monitor `refund_required` and stuck `pending_payment` orders.
6. Possible admin polish: drag-and-drop ordering, product image deletion from Storage, per-product SEO preview, saved report views.
7. The work went in as one large commit; future changes should be committed in small logical pieces.

## 7. Gotchas

- Next.js 16.4 differs from older versions; read `node_modules/next/dist/docs/` first. Request-time reads must be behind `<Suspense>` (Cache Components). Admin pages export `instant = false` (staff-only, per-user, blocks on the server by design) and must not read `Date.now()` before dynamic data (`performance.now()` is used for the token memo).
- `proxy.ts` (Next 16's middleware) only refreshes admin sessions and redirects; it is not the security boundary.
- Server code that returns data to React must not call helpers from `"use client"` modules (a bug found and fixed: shared form defaults live in `src/lib/admin/product-values.ts`).
- Postgres `timestamptz` is parsed to ISO strings in `db.ts` (not `Date` objects) so values behave the same in JSON, props and comparisons.
- Migrations re-run in full each time (`db:migrate`): `0002` revokes all table grants and later files re-grant theirs; every migration ends with the function revoke loop and re-grants `is_catalog_staff()`. `0003`'s 13-argument `create_checkout_order` is dropped and replaced by `0008`'s 14-argument version on every run.
- `shadcn add` generated `select.tsx` etc. with a wrong `cn` import in this environment; it was fixed to `@/lib/utils`. Re-check after adding components.
- Windows shell quoting corrupts large inline scripts; write files with the editor tools.
- Unpaid orders with no live hold are auto-cancelled after 24 h by `expire_reservations`. A coupon use is freed when its order is cancelled.

## 8. Quick map of the work (for reviewing the diff)

- **Database:** `supabase/migrations/0001–0010`, `supabase/certs/`, `scripts/*`.
- **Server (storefront):** `src/lib/server/**` (except `admin/`), `src/app/api/**` (except `admin/`).
- **Admin server:** `src/lib/server/admin/**` (session, op dispatcher, `ops/*`, `queries/*`, exports, revenue, media), `src/app/api/admin/**`, `src/proxy.ts`, `src/lib/admin/**` (shared permissions, schemas, helpers).
- **Admin UI:** `src/app/admin/**`, `src/components/admin/**`.
- **Storefront changes:** `src/app/(main)/**`, `src/components/shop/**`, `src/components/checkout/{coupon-box,checkout-flow,review-step}.tsx`, `src/components/common/{markdown,cms-page,support-provider,whatsapp-link}.tsx`, `src/lib/services/{checkout,commerce-config}.ts`, `src/lib/server/{content,commerce-config,cms-page}.ts(x)`.
- **Tests:** `scripts/admin-verify*.mjs` (+ existing `db-verify`, `api-verify`).
- **Docs/config:** `README.md`, `Architecture.md`, `Admin-CMS.md`, `CLAUDE.md`, `handover.md`, `prompts/cms-plan.md`, `next.config.ts` (Storage image host), `package.json` (`react-markdown`, scripts).
