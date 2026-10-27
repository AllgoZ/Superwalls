-- Order administration (controlled fulfilment transitions, cancellation, internal notes) and promotions.
-- Nothing here can mark an order paid or move money: payment status still changes ONLY in finalize_payment.

-- --------------------------------------------------------------- order columns
alter table public.orders add column if not exists refunded_paise  bigint not null default 0;
alter table public.orders add column if not exists cancel_reason   text;
alter table public.orders add column if not exists cancelled_at    timestamptz;
alter table public.orders add column if not exists cancelled_by    uuid;
alter table public.order_status_events add column if not exists admin_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_refund_bounds') then
    alter table public.orders add constraint orders_refund_bounds
      check (refunded_paise >= 0 and refunded_paise <= total_paise) not valid;
    alter table public.orders validate constraint orders_refund_bounds;
  end if;
end $$;

create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (order_status, created_at desc);
create index if not exists orders_payment_idx on public.orders (payment_status, paid_at);
create index if not exists orders_paid_at_idx on public.orders (paid_at) where paid_at is not null;

create table if not exists public.order_notes (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  admin_id     uuid,
  admin_email  text,
  note         text not null check (char_length(btrim(note)) between 1 and 1000),
  created_at   timestamptz not null default now()
);
create index if not exists order_notes_order_idx on public.order_notes (order_id, created_at);

-- ------------------------------------------------------------------ promotions
create table if not exists public.promotions (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,23}$'),
  description              text not null default '' check (char_length(description) <= 300),
  discount_type            text not null check (discount_type in ('percent', 'fixed')),
  percent_off              integer check (percent_off between 1 and 100),
  fixed_off_paise          bigint check (fixed_off_paise > 0),
  min_order_paise          bigint not null default 0 check (min_order_paise >= 0),
  max_discount_paise       bigint check (max_discount_paise > 0),
  starts_at                timestamptz,
  expires_at               timestamptz,
  max_uses                 integer check (max_uses > 0),
  max_uses_per_customer    integer check (max_uses_per_customer > 0),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint promotions_type_fields check (
    (discount_type = 'percent' and percent_off is not null and fixed_off_paise is null)
    or (discount_type = 'fixed' and fixed_off_paise is not null and percent_off is null)
  ),
  constraint promotions_dates check (expires_at is null or starts_at is null or expires_at > starts_at)
);
create unique index if not exists promotions_code_uq on public.promotions (code);
drop trigger if exists promotions_updated_at on public.promotions;
create trigger promotions_updated_at before update on public.promotions
  for each row execute function public.set_updated_at();

-- One row per order that used a coupon. A cancelled order frees its use (counted through orders.order_status),
-- and the unique order_id makes a double redemption of the same order impossible.
create table if not exists public.promotion_redemptions (
  id              uuid primary key default gen_random_uuid(),
  promotion_id    uuid not null references public.promotions (id) on delete restrict,
  order_id        uuid not null unique references public.orders (id) on delete cascade,
  user_id         uuid,
  email           text not null,
  discount_paise  bigint not null check (discount_paise >= 0),
  created_at      timestamptz not null default now()
);
create index if not exists promotion_redemptions_promo_idx on public.promotion_redemptions (promotion_id, created_at desc);
create index if not exists promotion_redemptions_email_idx on public.promotion_redemptions (promotion_id, lower(email));

alter table public.orders add column if not exists promotion_id uuid references public.promotions (id) on delete restrict;
alter table public.orders add column if not exists coupon_code  text;

-- The single authority on whether a coupon applies and what it is worth. Used for the cart preview AND again,
-- under a row lock, when the order is created. The browser never supplies a discount amount.
create or replace function public.evaluate_promotion(p_code text, p_subtotal bigint, p_user uuid, p_email text)
returns jsonb language plpgsql set search_path = public as $$
declare
  p promotions%rowtype;
  v_total integer;
  v_mine integer;
  v_discount bigint;
begin
  select * into p from promotions where code = upper(btrim(coalesce(p_code, '')));
  if not found or not p.is_active then raise exception 'COUPON_NOT_FOUND' using errcode = 'P0001'; end if;
  if p.starts_at is not null and p.starts_at > now() then raise exception 'COUPON_NOT_STARTED' using errcode = 'P0001'; end if;
  if p.expires_at is not null and p.expires_at <= now() then raise exception 'COUPON_EXPIRED' using errcode = 'P0001'; end if;
  if p_subtotal < p.min_order_paise then raise exception 'COUPON_MIN_ORDER' using errcode = 'P0001'; end if;

  select count(*) filter (where true),
         count(*) filter (where r.user_id is not distinct from p_user and p_user is not null
                             or lower(r.email) = lower(coalesce(p_email, '')))
    into v_total, v_mine
    from promotion_redemptions r join orders o on o.id = r.order_id
    where r.promotion_id = p.id and o.order_status <> 'cancelled';
  if p.max_uses is not null and v_total >= p.max_uses then raise exception 'COUPON_EXHAUSTED' using errcode = 'P0001'; end if;
  if p.max_uses_per_customer is not null and v_mine >= p.max_uses_per_customer then
    raise exception 'COUPON_USED' using errcode = 'P0001';
  end if;

  v_discount := case p.discount_type
    when 'percent' then least((p_subtotal * p.percent_off) / 100, coalesce(p.max_discount_paise, p_subtotal))
    else p.fixed_off_paise end;
  -- A discount can never exceed what is being bought.
  v_discount := greatest(0, least(v_discount, p_subtotal));
  return jsonb_build_object('promotionId', p.id, 'code', p.code, 'discountPaise', v_discount, 'description', p.description);
end $$;

-- ------------------------------------------------------- checkout with a coupon
-- Same behaviour as migration 0003, plus an optional coupon. A coupon REPLACES the automatic discount.
drop function if exists public.create_checkout_order(text, uuid, text, text, text, jsonb, jsonb, bigint, bigint, bigint, text, integer, integer);
create or replace function public.create_checkout_order(
  p_idempotency_key text,
  p_user_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_address jsonb,
  p_items jsonb,
  p_expected_subtotal bigint,
  p_discount bigint,
  p_delivery bigint,
  p_token_hash text,
  p_reservation_minutes integer,
  p_max_qty integer,
  p_coupon_code text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_existing orders%rowtype;
  v_order_id uuid;
  v_number text;
  v_subtotal bigint := 0;
  v_discount bigint := p_discount;
  v_promo jsonb;
  v_lines integer;
  r record;
begin
  perform expire_reservations();

  select * into v_existing from orders where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.user_id is distinct from p_user_id
       or lower(v_existing.customer_email) <> lower(p_email) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;
    return jsonb_build_object('orderId', v_existing.id, 'orderNumber', v_existing.order_number, 'replayed', true);
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = 'P0001';
  end if;

  create temporary table if not exists _co_items (product_id text primary key, quantity integer not null) on commit drop;
  delete from _co_items;
  insert into _co_items
    select e ->> 'productId', sum((e ->> 'quantity')::integer)
    from jsonb_array_elements(p_items) e group by 1;
  select count(*) into v_lines from _co_items;
  if v_lines > 50 or exists (select 1 from _co_items where quantity < 1 or quantity > p_max_qty) then
    raise exception 'VALIDATION:quantity' using errcode = 'P0001';
  end if;

  perform 1 from products where id in (select product_id from _co_items) order by id for update;
  for r in
    select c.product_id, c.quantity, p.price_paise, p.stock, p.stock_reserved, p.is_active
    from _co_items c left join products p on p.id = c.product_id order by c.product_id
  loop
    if r.price_paise is null or not r.is_active then
      raise exception 'OUT_OF_STOCK:%', r.product_id using errcode = 'P0001';
    end if;
    if r.stock - r.stock_reserved < r.quantity then
      raise exception 'OUT_OF_STOCK:%', r.product_id using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + r.price_paise * r.quantity;
  end loop;

  if v_subtotal <> p_expected_subtotal then
    raise exception 'PRICE_CHANGED' using errcode = 'P0001';
  end if;

  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    -- Serialises concurrent redemptions of one coupon, so the usage limits below cannot be raced past.
    perform 1 from promotions where code = upper(btrim(p_coupon_code)) for update;
    v_promo := evaluate_promotion(p_coupon_code, v_subtotal, p_user_id, p_email);
    v_discount := (v_promo ->> 'discountPaise')::bigint;
  end if;
  if v_discount < 0 or p_delivery < 0 or v_discount > v_subtotal then
    raise exception 'VALIDATION:amounts' using errcode = 'P0001';
  end if;

  begin
    v_number := 'SW-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || nextval('order_number_seq');
    insert into orders (
      order_number, customer_type, user_id, customer_name, customer_email, customer_phone, address_snapshot,
      subtotal_paise, discount_paise, delivery_paise, total_paise, idempotency_key, guest_tracking_token_hash,
      promotion_id, coupon_code
    ) values (
      v_number, case when p_user_id is null then 'guest' else 'registered' end, p_user_id,
      p_name, lower(p_email), p_phone, p_address,
      v_subtotal, v_discount, p_delivery, v_subtotal - v_discount + p_delivery, p_idempotency_key,
      case when p_user_id is null then p_token_hash end,
      (v_promo ->> 'promotionId')::uuid, v_promo ->> 'code'
    ) returning id into v_order_id;
  exception when unique_violation then
    select * into v_existing from orders where idempotency_key = p_idempotency_key;
    if not found then raise; end if;
    return jsonb_build_object('orderId', v_existing.id, 'orderNumber', v_existing.order_number, 'replayed', true);
  end;

  insert into order_items (order_id, product_id, name, image_src, unit_price_paise, quantity, line_total_paise)
    select v_order_id, p.id, p.name, p.images -> 0 ->> 'src', p.price_paise, c.quantity, p.price_paise * c.quantity
    from _co_items c join products p on p.id = c.product_id;

  if v_promo is not null then
    insert into promotion_redemptions (promotion_id, order_id, user_id, email, discount_paise)
      values ((v_promo ->> 'promotionId')::uuid, v_order_id, p_user_id, lower(p_email), v_discount);
  end if;

  perform reserve_order_stock(v_order_id, p_reservation_minutes);
  perform add_order_event(v_order_id, 'pending_payment', 'Order created, awaiting payment');

  return jsonb_build_object('orderId', v_order_id, 'orderNumber', v_number, 'replayed', false);
end $$;

-- ------------------------------------------------------------ fulfilment workflow
-- One step forward at a time. Only paid orders move; cancellation has its own workflow below.
create or replace function public.admin_set_order_status(p_actor uuid, p_order_id uuid, p_status text, p_note text)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_order orders%rowtype;
  v_rank constant text[] := array['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
  v_at integer;
begin
  if not admin_has_permission(p_actor, 'orders.update') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_order.order_status in ('delivered', 'cancelled') then raise exception 'ORDER_FINAL' using errcode = 'P0001'; end if;
  if v_order.payment_status <> 'paid' or v_order.order_status = 'pending_payment' then
    raise exception 'ORDER_NOT_PAID' using errcode = 'P0001';
  end if;

  v_at := array_position(v_rank, v_order.order_status);
  if p_status is null or array_position(v_rank, p_status) is distinct from v_at + 1 then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  update orders set order_status = p_status where id = p_order_id;
  insert into order_status_events (order_id, status, note, admin_id)
    values (p_order_id, p_status, nullif(btrim(coalesce(p_note, '')), ''), p_actor);
  return jsonb_build_object('orderId', p_order_id, 'from', v_order.order_status, 'to', p_status);
end $$;

-- Cancellation. Allowed until the parcel ships, and only once (a cancelled order is final).
--   unpaid order -> its stock hold is released and open payment attempts are cancelled;
--   paid order   -> stock goes back on the shelf (with a ledger entry) and the payment is FLAGGED refund_required.
--                   The refund itself is not performed or claimed here: that belongs to the payment gateway.
create or replace function public.admin_cancel_order(p_actor uuid, p_order_id uuid, p_reason text)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_order orders%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_restocked integer := 0;
  v_was_paid boolean;
begin
  if not admin_has_permission(p_actor, 'orders.update') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 300 then
    raise exception 'VALIDATION:reason' using errcode = 'P0001';
  end if;

  -- Lock order: products (by id) -> orders -> payments -> reservations.
  perform 1 from products where id in (select product_id from order_items where order_id = p_order_id) order by id for update;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_order.order_status = 'cancelled' or v_order.order_status = 'delivered' then
    raise exception 'ORDER_FINAL' using errcode = 'P0001';
  end if;
  if v_order.order_status not in ('pending_payment', 'placed', 'confirmed', 'processing') then
    raise exception 'NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  v_was_paid := v_order.payment_status = 'paid';

  if v_was_paid then
    -- Stock was deducted when the payment was verified: put it back, once, and say so in the ledger.
    with back as (
      update products p set stock = p.stock + r.quantity
        from inventory_reservations r
        where r.order_id = p_order_id and r.status = 'confirmed' and p.id = r.product_id
        returning p.id as product_id, p.stock as after_qty, r.quantity as qty
    )
    insert into inventory_movements (product_id, kind, quantity_before, quantity_change, quantity_after, reason, admin_id, order_id)
      select product_id, 'order_cancelled', after_qty - qty, qty, after_qty, 'Order cancelled: ' || left(v_reason, 200), p_actor, p_order_id from back;
    get diagnostics v_restocked = row_count;
    update inventory_reservations set status = 'released' where order_id = p_order_id and status = 'confirmed';
    update payments set refund_required = true, failure_reason = coalesce(failure_reason, 'order_cancelled')
      where order_id = p_order_id and status = 'paid';
  else
    perform release_order_stock(p_order_id, 'released');
    update payments set status = 'cancelled', failure_reason = coalesce(failure_reason, 'order_cancelled')
      where order_id = p_order_id and status in ('pending', 'initiated');
  end if;

  update orders set
    order_status = 'cancelled',
    payment_status = case when v_was_paid then payment_status else 'cancelled' end,
    cancel_reason = v_reason, cancelled_at = now(), cancelled_by = p_actor
    where id = p_order_id;
  insert into order_status_events (order_id, status, note, admin_id)
    values (p_order_id, 'cancelled',
            case when v_was_paid then 'Cancelled by staff: ' || v_reason || '. Refund required.' else 'Cancelled by staff: ' || v_reason end,
            p_actor);

  return jsonb_build_object('orderId', p_order_id, 'wasPaid', v_was_paid, 'refundRequired', v_was_paid, 'restockedLines', v_restocked);
end $$;

-- --------------------------------------------------------------------- lockdown
alter table public.order_notes             enable row level security;
alter table public.promotions              enable row level security;
alter table public.promotion_redemptions   enable row level security;
revoke all on public.order_notes, public.promotions, public.promotion_redemptions from anon, authenticated;

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
grant execute on function public.is_catalog_staff() to authenticated;
