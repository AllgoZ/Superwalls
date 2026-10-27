@AGENTS.md

# SuperWalls – instructions for Claude Code

Mobile-first storefront: Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 + shadcn/base-ui + Supabase (Postgres/Auth/RLS). Read [README.md](README.md) for usage, [Architecture.md](Architecture.md) for design, [Admin-CMS.md](Admin-CMS.md) for the admin panel, [handover.md](handover.md) for current status and next steps.

## Non-negotiables

- **Next.js here is not the one you know.** Before framework-level changes (routing, caching, `params`, route handlers, `next.config.ts`) read the matching guide in `node_modules/next/dist/docs/`. Known specifics: `params`/`searchParams` are async and must be read behind `<Suspense>`; use `connection()` for request-time data; Route Handlers that must not prerender need request access; rethrow Next control-flow errors with `unstable_rethrow`; run `npx next typegen` if `PageProps`/`RouteContext` types are missing.
- **Online payment only. Guest and registered checkout both stay supported.** Never add Cash on Delivery.
- **Never simulate a successful production payment.** With no gateway configured, checkout must return `503 PAYMENT_NOT_CONFIGURED` before creating an order. The sandbox gateway is dev-only and must stay refused when `NODE_ENV=production`.
- **Privileged credentials stay server-side.** Do not introduce a `NEXT_PUBLIC_` variable for anything secret, and do not add a service-role key. Server code lives in `src/lib/server/` and starts with `import "server-only"`.
- **Do not trust the client.** Prices, totals, stock, payment status and ownership are decided server-side/in SQL. A redirect or client callback never marks an order paid; only `finalize_payment` (from a verified event) does.
- **Money is integer paise** end to end. Format only at the UI edge (`src/lib/formatters`).
- **Never commit secrets.** `.env.local` is git-ignored; `.env.example` is a credential-free template. Don't print secret values in output or logs.
- Keep the existing 3-step checkout design; extend it, don't rebuild it.
- **Admin identity lives only in `admin_members`** (never in user-editable metadata), and customers never get admin rights automatically. There is no public admin sign-up. Every admin page and every admin mutation re-checks the session and the permission on the server; hiding a link is not security. The CMS must never mark an order paid, create a payment session or claim a refund happened.

## Commands

```bash
npm run dev            # http://localhost:3000
npm run typecheck      # tsc --noEmit
npm run lint           # eslint (CI bar: --max-warnings=0)
npm run build          # production build
npm run db:migrate     # apply supabase/migrations/*.sql (idempotent) using SUPABASE_DB_URL
npm run db:verify      # 73 database checks (races, RLS, idempotency, guest isolation)
npm run api:verify     # 100 end-to-end checks; needs `npm run dev` running and PAYMENT_PROVIDER=sandbox
npm run admin:verify   # admin CMS checks (auth, roles, every module, storefront sync); needs `npm run dev` (BASE_URL=http://localhost:<port> if not 3000)
npm run admin:bootstrap -- --email you@example.com   # provision the FIRST super admin (see Admin-CMS.md)
```

Definition of done for a change: `typecheck`, `lint`, and `build` clean; if you touched SQL or `src/lib/server/**` or `src/app/api/**`, also `db:migrate` + `db:verify` + `api:verify`; if you touched anything under `src/**/admin/**`, `src/app/admin/**` or storefront content, also `admin:verify`.

## Conventions

- **Database changes** go in a new numbered file under `supabase/migrations/` (never edit an applied migration's meaning silently; migrations must stay idempotent). New functions are `SECURITY DEFINER`, set `search_path`, and have `EXECUTE` revoked from `public/anon/authenticated` (migration 0003's final loop does this for all public functions; repeat that revoke for any function a later migration adds). Lock order: products (by id) → orders → payments → reservations.
- **New table = RLS on + explicit grants.** Default is no access for `anon`/`authenticated`.
- **Adding an API route:** wrap in `handle()` from `src/lib/server/http.ts`, validate input with a zod schema from `src/lib/checkout/contract.ts` (or add one), call `enforceRateLimit`, throw `ApiError` with a stable code. Add checks to `scripts/api-verify.mjs`.
- **Adding a payment provider:** implement `PaymentGateway` (`src/lib/server/payments/types.ts`), register in `payments/index.ts`, verify signatures over the raw body before parsing, return a stable `eventId`. Details in README "Payment gateway setup".
- **UI reads data via the service layer** (`src/lib/services`), not by calling Supabase from components. Shared request/response shapes live in `src/lib/checkout/contract.ts`.
- **Styling:** Tailwind v4 tokens in `src/app/globals.css` (brand blue ≈ `#0654B4`, yellow ≈ `#FCC000`); reuse `src/components/ui` and `src/components/common` before adding new primitives. Mobile-first.
- Match surrounding code style; no unnecessary comments; keep comments for non-obvious *why*.

- **Adding an admin feature:** read queries go in `src/lib/server/admin/queries/` (take the `AdminContext`, call `assertCan`); mutations are entries in `src/lib/server/admin/ops/` made with `defineOp({ name, permission, input: zod, run, audit, revalidate })` and registered in `ops/index.ts`. The single dispatcher `POST /api/admin/op/<name>` does origin check, session, permission, rate limit, validation, audit log and cache invalidation. Pages call `requireAdmin("<permission>")` first and export `instant = false`. New permissions: add to `src/lib/admin/permissions.ts` AND the matrix in a new migration (`admin_role_permissions`). Revenue is defined once in `src/lib/server/admin/revenue.ts`; never re-derive it.
- Admin migrations (0006+): every new table has RLS on and no browser grants unless the storefront must read it; every new SQL function re-checks `admin_has_permission` and the migration ends with the revoke loop (and re-grants `is_catalog_staff()`).

## Environment notes (this machine)

- Windows 11; use PowerShell or Git Bash. Beware shell escaping when writing JS/SQL via heredocs; prefer the Write/Edit tools for files. Ports 3000 and 3100 are often taken by other projects here: run this app on a free port (`npm run dev -- --port 3457`) and pass `BASE_URL` to the verify scripts.
- The DB is reached through the Supabase **IPv4 session pooler** (direct host is IPv6-only). The password must be URL-encoded in `SUPABASE_DB_URL`; `scripts/db-url.mjs` parses it with verified TLS using `supabase/certs/supabase-prod-ca-2021.crt`. Do not set `rejectUnauthorized: false`.
- Don't commit or push unless asked. The Admin CMS work is committed on `main`; check `git status` before starting and keep new changes in small commits when asked.

## Keeping docs current

When behaviour changes, update in the same change: README (user-facing usage), Architecture.md (design/flows/security), handover.md (status, decisions, next steps, "last updated" date). Check numbers before quoting them (verification counts, route lists).
