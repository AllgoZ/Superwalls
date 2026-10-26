# SuperWalls – mobile-first storefront

Frontend for **SuperWalls** (*Cleaner Homes, Happy Life*): a small, app-like shopping experience built with Next.js (App Router), TypeScript, Tailwind CSS v4 and shadcn/ui.

> **This is a demo build.** Products, prices, delivery fees, discounts, orders and the sign-in are placeholders running on local mock data. No real order is placed, no payment is taken, and Supabase and WhatsApp are **not** connected yet.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`, and `npx tsc --noEmit`.

Requires Node 20+ (developed on Node 24). No environment variables are needed to run.

## Environment variables

See [.env.example](.env.example). All are optional.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase credentials. Never expose a service-role key to the browser. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Business WhatsApp number (digits with country code, no `+`). Until set, the UI says "WhatsApp support coming soon". |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Shown on the Help page when set. |

## Routes

| Route | Description |
|---|---|
| `/` | Storefront: hero, product grid, trust strip, footer |
| `/products/[id]` | Product details with quantity selector (sticky add-to-cart bar on mobile) |
| `/cart` | Cart with quantity controls, remove/undo, totals |
| `/buy` | **Buy Now** checkout for one product (the default flow). Same three steps; the cart is untouched. Redirects to Orders after the order |
| `/checkout` | Same three steps for the whole cart: Delivery → Review & Pay → Confirmation |
| `/orders`, `/orders/[id]` | Order history, details and status timeline |
| `/profile` | Account, saved addresses, support links, preferences, version |
| `/help`, `/privacy`, `/terms` | FAQ and contact; placeholder legal pages |

Mobile shows a bottom navigation (Home · Orders · Profile) on the main pages. It is hidden on product, cart and checkout, where a sticky action bar owns the bottom of the screen. From `md` up, a top navigation replaces it.

## Buying flow

Tapping **Buy Now** on a product card opens a bottom sheet with a quantity stepper. **Buy Now** (primary, next to the stepper) goes straight to `/buy`: address, review and payment method, then confirmation, which auto-continues to **Orders** after 5 s (with a "Stay here" button). **Add to Cart & keep shopping** in the same sheet is the secondary path, for people who want more than one product; they check out later from `/cart`. The product page has the same pair.

## Demo mode

Everything below is simulated on-device and stored in `localStorage`:

- **Catalog**: six clearly labelled demo products (`src/lib/services/mock/catalog.ts`) with placeholder SVG images in `public/products`. Replace these when real data exists.
- **Orders**: three seeded sample orders plus any you create at checkout. All are tagged **Demo**. The demo does not decrement stock.
- **Sign-in**: "Sign in (demo)" only flips a flag. There is no password and no real security.
- **Payments**: Cash on Delivery works (payment status stays *pending*). Online payment is configured but disabled; there is no fake gateway and the app never collects card details.
- **Policies**: delivery fee, free-delivery threshold, discount rule, per-item limit and payment methods live in `src/lib/config/commerce.ts` and are demo values.

To reset demo data, clear this site's local storage (keys starting `sw-`).

Supabase credentials, when present, are only detected. The repositories keep using mock data until Supabase implementations are written, and the Profile → Version row says so.

## Architecture

```
src/
  app/                 Routes. (main) has the bottom nav; (flow) is product/cart/checkout.
  components/          UI by area: ui (shadcn), common, layout, shop, cart, checkout, orders, profile
  lib/
    config/            site, commerce policy, support, env detection
    types/             Product, CartItem, Order, Address, PaymentMethod, statuses, ...
    commerce/pricing.ts  The only place totals are computed (integer paise)
    formatters/        INR (en-IN) and date formatting
    validation/        Zod schemas: Indian mobile and PIN, address, profile
    orders/status.ts   Central status labels, tones and timeline order
    services/          UI-facing functions + contracts + repositories
      mock/            Demo implementations (localStorage)
    stores/cart-store.ts  Zustand cart, persisted (ids + quantities only)
    supabase/client.ts    Lazy browser client; null without credentials
    support/whatsapp.ts   Click-to-chat link builder
```

Key decisions:

- **UI → services → repositories.** Components call `getProducts()`, `getOrders()`, `createOrder()`, etc. `services/repositories.ts` is the single switch between mock and Supabase implementations.
- **Money is integer paise** everywhere and formatted with `Intl` (`en-IN`, INR).
- **The cart stores only product ids and quantities.** Prices always come from the catalog, so a price change can't leave stale prices in a saved cart.
- **`createOrder` input carries no prices or totals.** The service recomputes them from the catalog, matching what a trusted server must do.
- **Checkout safety.** The order is created only when *Place Order* succeeds. A ref lock plus a disabled button block double submits, and an idempotency key (`clientRequestId`) makes retries safe.
- **State**: Zustand for the cart only; other data is fetched through services with a small `useServiceQuery` hook.
- **Next.js 16 Cache Components** are on. Runtime-only hooks such as `usePathname` sit behind `Suspense`.

## Supabase integration (future)

1. Implement the interfaces in `src/lib/services/contracts.ts` with `@supabase/supabase-js` (e.g. `src/lib/services/supabase/*.ts`) and return them from `services/repositories.ts` when `isSupabaseConfigured`.
2. Replace the mock auth with Supabase Auth; `Session`/`CustomerProfile` already match.
3. Expected tables (snake_case):

| Table | Key columns |
|---|---|
| `products` | `id`, `name`, `tagline`, `description`, `price_paise`, `compare_at_price_paise`, `unit`, `images` (jsonb), `stock`, `is_active` |
| `profiles` | `id` (= `auth.users.id`), `full_name`, `email`, `mobile` |
| `addresses` | `id`, `user_id`, `full_name`, `mobile`, `line1`, `area`, `city`, `state`, `pincode`, `instructions`, `is_default` |
| `orders` | `id`, `order_number`, `user_id`, `status`, `payment_method`, `payment_status`, `subtotal_paise`, `discount_paise`, `delivery_paise`, `total_paise`, `address` (jsonb snapshot), `client_request_id` (unique), `created_at` |
| `order_items` | `id`, `order_id`, `product_id`, `name`, `unit_price_paise`, `quantity`, `line_total_paise` |
| `order_status_events` | `id`, `order_id`, `status`, `created_at` |

4. **Order creation must be server-authoritative**: a database function (RPC) or server route that, in one transaction, validates items and stock, recomputes prices, discount, delivery fee and total from the database, decrements stock, writes the order and items, and enforces the unique `client_request_id`. Never trust client amounts.
5. **Row Level Security** is *not* configured by this repo. Before launch, enable RLS on every table so users can read and write only their own `profiles`, `addresses`, `orders` and `order_items`. Products should be readable by everyone but writable only by staff. Customers must not be able to update `orders.status`.
6. Keep any service-role key on the server only.

## WhatsApp (future)

`src/lib/support/whatsapp.ts` builds `https://wa.me/<number>?text=<message>` links, and the number comes from `NEXT_PUBLIC_WHATSAPP_NUMBER`.

| Works with a plain WhatsApp link | Needs the WhatsApp Business API + webhook |
|---|---|
| "Chat on WhatsApp" with a prefilled message, optionally with an order number | Automatic order-status notifications |
| | Receiving and routing replies, chatbots, or in-app tracking from WhatsApp |
| | Template messages, opt-in handling and delivery receipts |

Messages never include personal data beyond an order number. Nothing in this repo sends or receives WhatsApp messages.

## Brand assets

`public/brand/` holds crops of the supplied logo (`reference/logo.jpeg`) with the stray black strip removed. The source is a 720 px JPEG with a white background, so the crops are slightly soft at large sizes. Supply a vector or transparent PNG when available. Brand colours were sampled from the logo (blue ≈ `#0654B4`, yellow ≈ `#FCC000`) and live in `src/app/globals.css`.

## Verification performed

`tsc --noEmit`, `eslint` and `next build` pass. A scripted browser run (Playwright, 390 px mobile and 1280 px desktop, no Supabase credentials) covered: add to cart and reload persistence, totals and quantity limits, remove/undo, checkout validation and step navigation, retaining entered values on back, double-click on Place Order creating one order, confirmation, the new order appearing in Orders and its detail page, bottom-nav active state, profile sign-in/edit/address, invalid product and order ids, and horizontal-overflow checks. No automated test suite is committed.
