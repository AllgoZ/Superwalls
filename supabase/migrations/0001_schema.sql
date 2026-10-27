-- SuperWalls core schema: catalog, accounts, guest + registered orders, payments, inventory.
-- Money is integer paise (bigint). Fulfilment status and payment status are separate columns.
-- Apply with `npm run db:migrate`. Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- products
-- `stock` is on-hand units; `stock_reserved` is units held by unexpired payment reservations.
-- Available = stock - stock_reserved. The CHECK is the hard backstop against overselling.
create table if not exists public.products (
  id                      text primary key,
  name                    text not null,
  tagline                 text not null default '',
  description             text not null default '',
  price_paise             bigint not null check (price_paise >= 0),
  compare_at_price_paise  bigint check (compare_at_price_paise is null or compare_at_price_paise > 0),
  unit                    text not null default '',
  images                  jsonb not null default '[]'::jsonb,
  stock                   integer not null default 0 check (stock >= 0),
  stock_reserved          integer not null default 0 check (stock_reserved >= 0),
  is_active               boolean not null default true,
  is_demo                 boolean not null default false,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint products_reserved_le_stock check (stock_reserved <= stock)
);
alter table public.products add column if not exists sort_order integer not null default 0;
drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  mobile      text check (mobile is null or mobile = '' or mobile ~ '^[6-9][0-9]{9}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile row is created for every new auth user, from the sign-up metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, mobile)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 80), ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'mobile', '')
  )
  on conflict (id) do nothing;
  return new;
exception when check_violation then
  -- A malformed mobile in metadata must never block sign-up.
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 80), ''), new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- addresses
create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 2 and 80),
  mobile        text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  line1         text not null check (char_length(line1) between 5 and 200),
  area          text not null check (char_length(area) between 2 and 100),
  city          text not null check (char_length(city) between 2 and 60),
  state         text not null check (char_length(state) >= 1),
  pincode       text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  instructions  text not null default '' check (char_length(instructions) <= 200),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);
create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id) where is_default;
drop trigger if exists addresses_updated_at on public.addresses;
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- Setting a default demotes the user's previous default in the same statement.
create or replace function public.addresses_single_default() returns trigger
language plpgsql as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
      where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end $$;
drop trigger if exists addresses_single_default on public.addresses;
create trigger addresses_single_default before insert or update of is_default on public.addresses
  for each row when (new.is_default) execute function public.addresses_single_default();

-- ------------------------------------------------------------------ orders
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id                        uuid primary key default gen_random_uuid(),
  order_number              text not null unique,
  customer_type             text not null check (customer_type in ('registered', 'guest')),
  -- Restrict, not set null: deleting a customer must not silently orphan (and un-own) their orders.
  user_id                   uuid references auth.users (id) on delete restrict,
  customer_name             text not null,
  customer_email            text not null,
  customer_phone            text not null,
  address_snapshot          jsonb not null,
  subtotal_paise            bigint not null check (subtotal_paise >= 0),
  discount_paise            bigint not null default 0 check (discount_paise >= 0),
  delivery_paise            bigint not null default 0 check (delivery_paise >= 0),
  total_paise               bigint not null check (total_paise >= 0),
  currency                  text not null default 'INR',
  order_status              text not null default 'pending_payment' check (order_status in
    ('pending_payment','placed','confirmed','processing','shipped','out_for_delivery','delivered','cancelled')),
  payment_status            text not null default 'pending' check (payment_status in
    ('pending','initiated','paid','failed','cancelled','refunded','partially_refunded')),
  payment_provider          text,
  payment_reference         text,
  idempotency_key           text not null unique check (char_length(idempotency_key) between 16 and 128),
  -- SHA-256 of the guest access token. The raw token is shown once and never stored.
  guest_tracking_token_hash text,
  claimed_at                timestamptz,
  placed_at                 timestamptz,
  paid_at                   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  -- Ownership: a registered order has an owner and no guest token; a guest order has a token and no owner.
  constraint orders_ownership check (
    (customer_type = 'registered' and user_id is not null and guest_tracking_token_hash is null)
    or (customer_type = 'guest' and user_id is null and guest_tracking_token_hash is not null)
  ),
  constraint orders_total_matches check (total_paise = subtotal_paise - discount_paise + delivery_paise)
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc) where user_id is not null;
create index if not exists orders_guest_token_idx on public.orders (guest_tracking_token_hash)
  where guest_tracking_token_hash is not null;
create index if not exists orders_email_idx on public.orders (lower(customer_email));
create index if not exists orders_pending_idx on public.orders (created_at) where order_status = 'pending_payment';
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        text not null references public.products (id),
  name              text not null,
  image_src         text,
  unit_price_paise  bigint not null check (unit_price_paise >= 0),
  quantity          integer not null check (quantity > 0),
  line_total_paise  bigint not null check (line_total_paise >= 0),
  unique (order_id, product_id),
  constraint order_items_line_total check (line_total_paise = unit_price_paise * quantity)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  status      text not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists order_status_events_order_idx on public.order_status_events (order_id, created_at);

-- ---------------------------------------------------------------- payments
-- One row per payment attempt. An order can have several (retries), but never two live ones.
create table if not exists public.payments (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  provider             text not null,
  provider_order_id    text,
  provider_payment_id  text,
  amount               bigint not null check (amount >= 0),
  currency             text not null default 'INR',
  status               text not null default 'pending' check (status in
    ('pending','initiated','paid','failed','cancelled','refunded','partially_refunded')),
  idempotency_key      text not null unique,
  refund_required      boolean not null default false,
  failure_reason       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments (order_id);
create unique index if not exists payments_provider_order_uq
  on public.payments (provider, provider_order_id) where provider_order_id is not null;
create unique index if not exists payments_provider_payment_uq
  on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create unique index if not exists payments_one_live_attempt
  on public.payments (order_id) where status in ('pending', 'initiated');
drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Every webhook / verified confirmation is recorded once; the unique key makes replays no-ops.
create table if not exists public.payment_events (
  id            bigint generated always as identity primary key,
  provider      text not null,
  event_id      text not null,
  event_type    text not null,
  payload       jsonb not null default '{}'::jsonb,
  result        text,
  received_at   timestamptz not null default now(),
  unique (provider, event_id)
);

-- --------------------------------------------------------------- inventory
create table if not exists public.inventory_reservations (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  text not null references public.products (id),
  quantity    integer not null check (quantity > 0),
  status      text not null default 'active' check (status in ('active', 'confirmed', 'released', 'expired')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists reservations_active_expiry_idx
  on public.inventory_reservations (expires_at) where status = 'active';
drop trigger if exists reservations_updated_at on public.inventory_reservations;
create trigger reservations_updated_at before update on public.inventory_reservations
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- rate limits
create table if not exists public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null default now(),
  hits          integer not null default 0
);
