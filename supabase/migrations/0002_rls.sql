-- Row Level Security and table privileges.
--
-- Model:
--   * Browsers (anon / authenticated JWTs) may only READ the catalog and THEIR OWN rows.
--   * Orders, order items, payments, reservations and webhook events are never writable from a browser.
--   * Guest orders have no owner, so no policy matches them: they are reachable only through
--     the server-side `get_guest_order` function with a valid tracking token.
--   * Everything privileged runs on the server's own Postgres connection (see supabase/migrations/0003).

alter table public.products                enable row level security;
alter table public.profiles                enable row level security;
alter table public.addresses               enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.order_status_events     enable row level security;
alter table public.payments                enable row level security;
alter table public.payment_events          enable row level security;
alter table public.inventory_reservations  enable row level security;
alter table public.rate_limits             enable row level security;

-- Start from zero privileges, then grant only what is needed.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Catalog: public read of active products.
grant select on public.products to anon, authenticated;
drop policy if exists products_read_active on public.products;
create policy products_read_active on public.products for select
  to anon, authenticated using (is_active);

-- Profiles: read / edit own. Email is owned by Supabase Auth, so it is not client-editable.
grant select on public.profiles to authenticated;
grant update (full_name, mobile) on public.profiles to authenticated;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Saved addresses: full control of own rows.
grant select, insert, update, delete on public.addresses to authenticated;
drop policy if exists addresses_select_own on public.addresses;
create policy addresses_select_own on public.addresses for select
  to authenticated using (user_id = (select auth.uid()));
drop policy if exists addresses_insert_own on public.addresses;
create policy addresses_insert_own on public.addresses for insert
  to authenticated with check (user_id = (select auth.uid()));
drop policy if exists addresses_update_own on public.addresses;
create policy addresses_update_own on public.addresses for update
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists addresses_delete_own on public.addresses;
create policy addresses_delete_own on public.addresses for delete
  to authenticated using (user_id = (select auth.uid()));

-- Orders: read-only for the owner, and only the columns a customer needs
-- (never the token hash, idempotency key or provider references).
grant select (
  id, order_number, customer_type, user_id, customer_name, customer_email, customer_phone,
  address_snapshot, subtotal_paise, discount_paise, delivery_paise, total_paise, currency,
  order_status, payment_status, placed_at, paid_at, created_at, updated_at
) on public.orders to authenticated;
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders for select
  to authenticated using (user_id = (select auth.uid()));

grant select on public.order_items to authenticated;
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own on public.order_items for select
  to authenticated using (exists (
    select 1 from public.orders o where o.id = order_items.order_id and o.user_id = (select auth.uid())
  ));

grant select (order_id, status, note, created_at) on public.order_status_events to authenticated;
drop policy if exists order_status_events_select_own on public.order_status_events;
create policy order_status_events_select_own on public.order_status_events for select
  to authenticated using (exists (
    select 1 from public.orders o where o.id = order_status_events.order_id and o.user_id = (select auth.uid())
  ));

-- payments, payment_events, inventory_reservations, rate_limits: RLS on, no grants, no policies = no browser access.
