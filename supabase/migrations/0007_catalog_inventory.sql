-- Catalog management: categories, richer products, the `catalog` image bucket, and an auditable stock ledger.
-- Existing products, prices, orders and order_items are untouched: every change is additive.

-- ------------------------------------------------------------------ categories
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 60),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description  text not null default '' check (char_length(description) <= 500),
  image_url    text,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists categories_slug_uq on public.categories (slug);
create unique index if not exists categories_name_uq on public.categories (lower(name));
drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------- products
-- `tagline` stays the short description; `id` stays the permanent URL slug (carts, orders and links depend on it).
alter table public.products add column if not exists category_id          uuid references public.categories (id) on delete restrict;
alter table public.products add column if not exists sku                  text check (sku is null or char_length(sku) between 1 and 40);
alter table public.products add column if not exists low_stock_threshold  integer not null default 5 check (low_stock_threshold >= 0);
alter table public.products add column if not exists is_featured          boolean not null default false;
alter table public.products add column if not exists seo_title            text not null default '' check (char_length(seo_title) <= 120);
alter table public.products add column if not exists seo_description      text not null default '' check (char_length(seo_description) <= 320);
alter table public.products add column if not exists archived_at          timestamptz;

create unique index if not exists products_sku_uq on public.products (lower(sku)) where sku is not null;
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_listing_idx on public.products (is_active, sort_order);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_compare_gt_price') then
    alter table public.products add constraint products_compare_gt_price
      check (compare_at_price_paise is null or compare_at_price_paise > price_paise) not valid;
    alter table public.products validate constraint products_compare_gt_price;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_images_array') then
    alter table public.products add constraint products_images_array
      check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 10) not valid;
    alter table public.products validate constraint products_images_array;
  end if;
end $$;

-- ------------------------------------------------------------------ stock ledger
-- Every change to `products.stock` made by staff or by a verified payment is recorded here, never silently.
create table if not exists public.inventory_movements (
  id               bigint generated always as identity primary key,
  product_id       text not null references public.products (id) on delete cascade,
  kind             text not null check (kind in ('adjustment', 'correction', 'restock', 'sale', 'order_cancelled', 'damage', 'return')),
  quantity_before  integer not null check (quantity_before >= 0),
  quantity_change  integer not null,
  quantity_after   integer not null check (quantity_after >= 0),
  reason           text not null default '' check (char_length(reason) <= 300),
  admin_id         uuid,
  order_id         uuid references public.orders (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint inventory_movements_math check (quantity_after = quantity_before + quantity_change)
);
create index if not exists inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);
create index if not exists inventory_movements_created_idx on public.inventory_movements (created_at desc);

-- Stock adjustment by staff. Atomic: the product row is locked, the new level is checked against units already
-- reserved by open checkouts (so a manual change can never invalidate a hold), and the movement is written
-- in the same transaction.
create or replace function public.admin_adjust_stock(
  p_actor uuid, p_product_id text, p_mode text, p_quantity integer, p_kind text, p_reason text
) returns jsonb language plpgsql set search_path = public as $$
declare
  p products%rowtype;
  v_new integer;
begin
  if not admin_has_permission(p_actor, 'inventory.adjust') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_mode not in ('delta', 'set') or p_kind not in ('adjustment', 'correction', 'restock', 'damage', 'return')
     or char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'VALIDATION:adjustment' using errcode = 'P0001';
  end if;

  select * into p from products where id = p_product_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;

  v_new := case p_mode when 'set' then p_quantity else p.stock + p_quantity end;
  if v_new < 0 then raise exception 'NEGATIVE_STOCK' using errcode = 'P0001'; end if;
  if v_new < p.stock_reserved then raise exception 'BELOW_RESERVED' using errcode = 'P0001'; end if;
  if v_new = p.stock then raise exception 'VALIDATION:no_change' using errcode = 'P0001'; end if;

  update products set stock = v_new where id = p.id;
  insert into inventory_movements (product_id, kind, quantity_before, quantity_change, quantity_after, reason, admin_id)
    values (p.id, p_kind, p.stock, v_new - p.stock, v_new, btrim(p_reason), p_actor);

  return jsonb_build_object('productId', p.id, 'before', p.stock, 'after', v_new, 'reserved', p.stock_reserved);
end $$;

-- A verified payment deducts stock (migration 0003). Same behaviour as before, plus a ledger row per product.
create or replace function public.confirm_order_stock(p_order_id uuid)
returns void language plpgsql set search_path = public as $$
begin
  perform 1 from products where id in (
    select product_id from inventory_reservations where order_id = p_order_id and status = 'active')
    order by id for update;

  with updated as (
    update products p set stock = p.stock - r.quantity,
                          stock_reserved = greatest(0, p.stock_reserved - r.quantity)
      from inventory_reservations r
      where r.order_id = p_order_id and r.status = 'active' and p.id = r.product_id
      returning p.id as product_id, p.stock as after_qty, r.quantity as qty
  )
  insert into inventory_movements (product_id, kind, quantity_before, quantity_change, quantity_after, reason, order_id)
    select product_id, 'sale', after_qty + qty, -qty, after_qty, 'Payment verified', p_order_id from updated;

  update inventory_reservations set status = 'confirmed'
    where order_id = p_order_id and status = 'active';
end $$;

-- ------------------------------------------------------------- storage (images)
-- Staff upload catalog images with their OWN session token; this policy is what authorises the write.
-- No service-role key is involved. Anyone can read the public bucket (these are storefront images).
create or replace function public.is_catalog_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.admin_has_permission((select auth.uid()), 'catalog.write')
      or public.admin_has_permission((select auth.uid()), 'content.write')
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists catalog_staff_select on storage.objects;
create policy catalog_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'catalog' and public.is_catalog_staff());
drop policy if exists catalog_staff_insert on storage.objects;
create policy catalog_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog' and public.is_catalog_staff());
drop policy if exists catalog_staff_update on storage.objects;
create policy catalog_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'catalog' and public.is_catalog_staff())
  with check (bucket_id = 'catalog' and public.is_catalog_staff());
drop policy if exists catalog_staff_delete on storage.objects;
create policy catalog_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catalog' and public.is_catalog_staff());

-- ------------------------------------------------------------------- RLS / grants
alter table public.categories          enable row level security;
alter table public.inventory_movements enable row level security;

grant select on public.categories to anon, authenticated;
drop policy if exists categories_read_active on public.categories;
create policy categories_read_active on public.categories for select
  to anon, authenticated using (is_active);
-- inventory_movements: RLS on, no grants, no policies = server only.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- The one function a browser session may execute: it answers only "am I catalog staff?" for the caller itself,
-- and exists so the Storage policies above can be evaluated. Re-granted after every lock-down loop.
grant execute on function public.is_catalog_staff() to authenticated;
