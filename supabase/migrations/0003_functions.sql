-- Server-side transactional operations.
--
-- These are the ONLY way orders, payments and stock change. They are never granted to
-- anon / authenticated (see the revoke loop at the bottom): only the server's own Postgres
-- connection can call them, after validating the request. Lock order everywhere is
-- products (by id) -> orders -> payments -> reservations, to avoid deadlocks.

-- ---------------------------------------------------------------- helpers
create or replace function public.order_json(p_order_id uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'customerType', o.customer_type,
    'createdAt', o.created_at,
    'placedAt', o.placed_at,
    'orderStatus', o.order_status,
    'paymentStatus', o.payment_status,
    'subtotalPaise', o.subtotal_paise,
    'discountPaise', o.discount_paise,
    'deliveryPaise', o.delivery_paise,
    'totalPaise', o.total_paise,
    'customerName', o.customer_name,
    'address', o.address_snapshot,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'productId', i.product_id, 'name', i.name, 'imageSrc', i.image_src,
        'unitPricePaise', i.unit_price_paise, 'quantity', i.quantity, 'lineTotalPaise', i.line_total_paise
      ) order by i.name) from order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.created_at, e.id)
      from order_status_events e where e.order_id = o.id), '[]'::jsonb)
  )
  from orders o where o.id = p_order_id
$$;

create or replace function public.add_order_event(p_order_id uuid, p_status text, p_note text default null)
returns void language sql set search_path = public as $$
  insert into order_status_events (order_id, status, note) values (p_order_id, p_status, p_note)
$$;

-- --------------------------------------------------------------- inventory
-- Reserve every item of an order. Locks the products in id order, refuses if any is short.
create or replace function public.reserve_order_stock(p_order_id uuid, p_minutes integer)
returns void language plpgsql set search_path = public as $$
declare
  r record;
begin
  perform 1 from products where id in (select product_id from order_items where order_id = p_order_id)
    order by id for update;

  for r in
    select i.product_id, i.quantity, p.stock, p.stock_reserved, p.is_active
    from order_items i join products p on p.id = i.product_id
    where i.order_id = p_order_id order by i.product_id
  loop
    if not r.is_active or r.stock - r.stock_reserved < r.quantity then
      raise exception 'OUT_OF_STOCK:%', r.product_id using errcode = 'P0001';
    end if;
  end loop;

  update products p set stock_reserved = p.stock_reserved + i.quantity
    from order_items i where i.order_id = p_order_id and p.id = i.product_id;

  insert into inventory_reservations (order_id, product_id, quantity, status, expires_at)
    select order_id, product_id, quantity, 'active', now() + make_interval(mins => p_minutes)
    from order_items where order_id = p_order_id
  on conflict (order_id, product_id) do update
    set quantity = excluded.quantity, status = 'active', expires_at = excluded.expires_at;
end $$;

-- Give back the stock held by an order's ACTIVE reservations.
create or replace function public.release_order_stock(p_order_id uuid, p_new_status text)
returns void language plpgsql set search_path = public as $$
begin
  perform 1 from products where id in (
    select product_id from inventory_reservations where order_id = p_order_id and status = 'active')
    order by id for update;

  update products p set stock_reserved = greatest(0, p.stock_reserved - r.quantity)
    from inventory_reservations r
    where r.order_id = p_order_id and r.status = 'active' and p.id = r.product_id;

  update inventory_reservations set status = p_new_status
    where order_id = p_order_id and status = 'active';
end $$;

-- Turn ACTIVE reservations into a permanent deduction (payment verified).
create or replace function public.confirm_order_stock(p_order_id uuid)
returns void language plpgsql set search_path = public as $$
begin
  perform 1 from products where id in (
    select product_id from inventory_reservations where order_id = p_order_id and status = 'active')
    order by id for update;

  update products p set stock = p.stock - r.quantity,
                        stock_reserved = greatest(0, p.stock_reserved - r.quantity)
    from inventory_reservations r
    where r.order_id = p_order_id and r.status = 'active' and p.id = r.product_id;

  update inventory_reservations set status = 'confirmed'
    where order_id = p_order_id and status = 'active';
end $$;

-- Expire stale holds and abandon long-unpaid orders. Safe to call from anywhere, any time.
create or replace function public.expire_reservations(p_abandon_hours integer default 24)
returns integer language plpgsql set search_path = public as $$
declare
  v_count integer := 0;
  r record;
begin
  perform 1 from products where id in (
    select product_id from inventory_reservations where status = 'active' and expires_at < now())
    order by id for update;

  for r in
    select id, product_id, quantity from inventory_reservations
    where status = 'active' and expires_at < now() order by product_id, id for update skip locked
  loop
    update products set stock_reserved = greatest(0, stock_reserved - r.quantity) where id = r.product_id;
    update inventory_reservations set status = 'expired' where id = r.id;
    v_count := v_count + 1;
  end loop;

  -- Orders that never got paid and hold no stock any more are cancelled after the grace period.
  for r in
    select o.id from orders o
    where o.order_status = 'pending_payment' and o.payment_status <> 'paid'
      and o.created_at < now() - make_interval(hours => p_abandon_hours)
      and not exists (select 1 from inventory_reservations v where v.order_id = o.id and v.status = 'active')
    for update skip locked
  loop
    update payments set status = 'cancelled', failure_reason = coalesce(failure_reason, 'order_abandoned')
      where order_id = r.id and status in ('pending', 'initiated');
    update orders set order_status = 'cancelled', payment_status = 'cancelled' where id = r.id;
    perform add_order_event(r.id, 'cancelled', 'Payment not completed');
  end loop;

  delete from rate_limits where window_start < now() - interval '1 day';
  return v_count;
end $$;

-- ----------------------------------------------------------- order creation
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
  p_max_qty integer
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_existing orders%rowtype;
  v_order_id uuid;
  v_number text;
  v_subtotal bigint := 0;
  v_lines integer;
  r record;
begin
  perform expire_reservations();

  -- Idempotent replay: same key => same order, but only for the same customer.
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

  -- Lock + validate every product (id order => no deadlocks between concurrent checkouts).
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
  if p_discount < 0 or p_delivery < 0 or p_discount > v_subtotal then
    raise exception 'VALIDATION:amounts' using errcode = 'P0001';
  end if;

  begin
    v_number := 'SW-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || nextval('order_number_seq');
    insert into orders (
      order_number, customer_type, user_id, customer_name, customer_email, customer_phone, address_snapshot,
      subtotal_paise, discount_paise, delivery_paise, total_paise, idempotency_key, guest_tracking_token_hash
    ) values (
      v_number, case when p_user_id is null then 'guest' else 'registered' end, p_user_id,
      p_name, lower(p_email), p_phone, p_address,
      v_subtotal, p_discount, p_delivery, v_subtotal - p_discount + p_delivery, p_idempotency_key,
      case when p_user_id is null then p_token_hash end
    ) returning id into v_order_id;
  exception when unique_violation then
    -- A concurrent request with the same key won the race; its order is ours too.
    select * into v_existing from orders where idempotency_key = p_idempotency_key;
    if not found then raise; end if;
    return jsonb_build_object('orderId', v_existing.id, 'orderNumber', v_existing.order_number, 'replayed', true);
  end;

  insert into order_items (order_id, product_id, name, image_src, unit_price_paise, quantity, line_total_paise)
    select v_order_id, p.id, p.name, p.images -> 0 ->> 'src', p.price_paise, c.quantity, p.price_paise * c.quantity
    from _co_items c join products p on p.id = c.product_id;

  perform reserve_order_stock(v_order_id, p_reservation_minutes);
  perform add_order_event(v_order_id, 'pending_payment', 'Order created, awaiting payment');

  return jsonb_build_object('orderId', v_order_id, 'orderNumber', v_number, 'replayed', false);
end $$;

-- ------------------------------------------------------------ payment attempts
-- Start (or resume) the single live payment attempt of an order. Used for the first try and every retry.
drop function if exists public.begin_payment_attempt(uuid, text, text, integer);
create or replace function public.begin_payment_attempt(
  p_order_id uuid, p_provider text, p_reservation_minutes integer
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_order orders%rowtype;
  v_pay payments%rowtype;
begin
  perform expire_reservations();

  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_order.payment_status = 'paid' then raise exception 'ALREADY_PAID' using errcode = 'P0001'; end if;
  if v_order.order_status <> 'pending_payment' then
    raise exception 'ORDER_NOT_PAYABLE' using errcode = 'P0001';
  end if;

  -- Stock must be held for the whole attempt. Re-reserve if the previous hold lapsed or was released.
  if exists (select 1 from inventory_reservations where order_id = p_order_id and status <> 'active')
     or not exists (select 1 from inventory_reservations where order_id = p_order_id) then
    perform reserve_order_stock(p_order_id, p_reservation_minutes);
  else
    update inventory_reservations
      set expires_at = greatest(expires_at, now() + make_interval(mins => p_reservation_minutes))
      where order_id = p_order_id and status = 'active';
  end if;

  -- The order row is locked, so concurrent callers queue here and the second one reuses the first one's attempt.
  select * into v_pay from payments where order_id = p_order_id and status in ('pending', 'initiated');
  if not found then
    insert into payments (order_id, provider, amount, currency, status, idempotency_key)
      values (p_order_id, p_provider, v_order.total_paise, v_order.currency, 'pending', gen_random_uuid()::text)
      returning * into v_pay;
    update orders set payment_status = 'pending', payment_provider = p_provider where id = p_order_id;
  end if;

  return jsonb_build_object(
    'paymentId', v_pay.id, 'amount', v_pay.amount, 'currency', v_pay.currency,
    'providerOrderId', v_pay.provider_order_id, 'provider', v_pay.provider,
    'reused', v_pay.provider_order_id is not null,
    'orderNumber', v_order.order_number, 'orderId', v_order.id
  );
end $$;

create or replace function public.record_payment_session(p_payment_id uuid, p_provider_order_id text)
returns void language plpgsql set search_path = public as $$
declare
  v_pay payments%rowtype;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_pay.status = 'paid' then return; end if;
  update payments set provider_order_id = coalesce(provider_order_id, p_provider_order_id), status = 'initiated'
    where id = p_payment_id;
  update orders set payment_status = 'initiated', payment_reference = coalesce(payment_reference, p_provider_order_id)
    where id = v_pay.order_id and payment_status <> 'paid';
end $$;

-- The gateway refused to create a session (outage, bad config): the attempt failed, the order stays retryable.
create or replace function public.fail_payment_attempt(p_payment_id uuid, p_reason text)
returns void language plpgsql set search_path = public as $$
declare
  v_pay payments%rowtype;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if not found or v_pay.status in ('paid', 'failed', 'cancelled') then return; end if;
  update payments set status = 'failed', failure_reason = left(p_reason, 200) where id = p_payment_id;
  update orders set payment_status = 'failed' where id = v_pay.order_id and payment_status <> 'paid';
end $$;

-- The one and only place a payment becomes 'paid'. Idempotent per (provider, event id).
create or replace function public.finalize_payment(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount bigint,
  p_currency text,
  p_outcome text,          -- 'paid' | 'failed' | 'cancelled'
  p_reason text,
  p_payload jsonb
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_pay payments%rowtype;
  v_order orders%rowtype;
  v_ins bigint;
  v_result text;
begin
  insert into payment_events (provider, event_id, event_type, payload)
    values (p_provider, p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb))
    on conflict (provider, event_id) do nothing returning id into v_ins;
  if v_ins is null then
    return jsonb_build_object('result', 'duplicate');
  end if;

  select * into v_pay from payments where provider = p_provider and provider_order_id = p_provider_order_id;
  if not found then
    update payment_events set result = 'unknown_payment' where id = v_ins;
    return jsonb_build_object('result', 'unknown_payment');
  end if;

  -- Lock order first, then payment (same order as every other function).
  select * into v_order from orders where id = v_pay.order_id for update;
  select * into v_pay from payments where id = v_pay.id for update;

  if p_outcome = 'paid' then
    if v_pay.status = 'paid' then
      v_result := 'already_paid';
    elsif p_amount is distinct from v_pay.amount or p_amount <> v_order.total_paise
          or upper(coalesce(p_currency, '')) <> upper(v_pay.currency) then
      -- Money moved but not the amount we asked for: never mark the order paid.
      update payments set status = 'failed', refund_required = true, failure_reason = 'amount_mismatch',
        provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id) where id = v_pay.id;
      v_result := 'amount_mismatch';
    elsif v_order.payment_status = 'paid' then
      -- The order was already paid through another attempt: this one is a double payment.
      update payments set status = 'paid', refund_required = true, failure_reason = 'duplicate_payment',
        provider_payment_id = p_provider_payment_id where id = v_pay.id;
      v_result := 'duplicate_payment_refund_required';
    elsif v_order.order_status <> 'pending_payment' then
      -- Paid after the order was cancelled / abandoned: keep the money record, flag for refund.
      update payments set status = 'paid', refund_required = true, failure_reason = 'order_not_payable',
        provider_payment_id = p_provider_payment_id where id = v_pay.id;
      update orders set payment_status = 'paid', paid_at = now(), payment_reference = p_provider_payment_id
        where id = v_order.id;
      v_result := 'late_payment_refund_required';
    else
      begin
        -- Reservation may have lapsed while the customer was paying: try to take the stock again.
        if exists (select 1 from inventory_reservations where order_id = v_order.id and status <> 'active')
           or not exists (select 1 from inventory_reservations where order_id = v_order.id) then
          perform reserve_order_stock(v_order.id, 5);
        end if;
        perform confirm_order_stock(v_order.id);
        update payments set status = 'paid', provider_payment_id = p_provider_payment_id, failure_reason = null
          where id = v_pay.id;
        update orders set payment_status = 'paid', order_status = 'placed', paid_at = now(), placed_at = now(),
          payment_reference = p_provider_payment_id where id = v_order.id;
        perform add_order_event(v_order.id, 'placed', 'Payment verified');
        v_result := 'paid';
      exception when others then
        if sqlerrm like 'OUT_OF_STOCK:%' then
          -- Sold out while the payment was in flight. The customer is owed a refund.
          update payments set status = 'paid', refund_required = true, failure_reason = 'out_of_stock_after_payment',
            provider_payment_id = p_provider_payment_id where id = v_pay.id;
          update orders set payment_status = 'paid', order_status = 'cancelled', paid_at = now(),
            payment_reference = p_provider_payment_id where id = v_order.id;
          perform add_order_event(v_order.id, 'cancelled', 'Out of stock after payment; refund required');
          v_result := 'out_of_stock_refund_required';
        else
          raise;
        end if;
      end;
    end if;

  else -- failed / cancelled
    if v_pay.status = 'paid' or v_order.payment_status = 'paid' then
      v_result := 'ignored_after_paid';
    else
      update payments set status = p_outcome, failure_reason = left(p_reason, 200),
        provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id) where id = v_pay.id;
      update orders set payment_status = p_outcome where id = v_order.id;
      -- Release the hold: the order stays pending_payment so the customer can retry.
      perform release_order_stock(v_order.id, 'released');
      v_result := p_outcome;
    end if;
  end if;

  update payment_events set result = v_result where id = v_ins;
  select * into v_order from orders where id = v_order.id;
  return jsonb_build_object('result', v_result, 'orderId', v_order.id, 'orderNumber', v_order.order_number,
    'orderStatus', v_order.order_status, 'paymentStatus', v_order.payment_status);
end $$;

-- ------------------------------------------------------------ guest access
create or replace function public.get_guest_order(p_order_number text, p_token_hash text)
returns jsonb language sql stable set search_path = public as $$
  select order_json(o.id) from orders o
  where o.order_number = p_order_number
    and o.guest_tracking_token_hash is not null
    and o.guest_tracking_token_hash = p_token_hash
$$;

-- Associate guest orders with a verified account. Eligibility is ownership proof, never a bare email:
--   (a) the caller holds the order's secret tracking token, or
--   (b) the account's email is VERIFIED by Supabase Auth (p_verified_email is null otherwise)
--       and matches the order's email.
create or replace function public.claim_guest_orders(
  p_user_id uuid, p_verified_email text, p_token_hashes text[]
) returns integer language plpgsql set search_path = public as $$
declare
  v_count integer;
begin
  with claimed as (
    update orders set customer_type = 'registered', user_id = p_user_id,
                      guest_tracking_token_hash = null, claimed_at = now()
    where customer_type = 'guest'
      and (
        guest_tracking_token_hash = any (coalesce(p_token_hashes, '{}'::text[]))
        or (p_verified_email is not null and lower(customer_email) = lower(p_verified_email))
      )
    returning id
  )
  select count(*) into v_count from claimed;
  return v_count;
end $$;

-- ------------------------------------------------------------- misc
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql set search_path = public as $$
declare
  v_hits integer;
begin
  insert into rate_limits as t (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.hits + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- Staff / back-office fulfilment transitions (called by trusted server code only).
create or replace function public.set_order_status(p_order_id uuid, p_status text, p_note text default null)
returns void language plpgsql set search_path = public as $$
declare
  v_order orders%rowtype;
  v_rank constant text[] := array['placed','confirmed','processing','shipped','out_for_delivery','delivered'];
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if v_order.payment_status <> 'paid' then raise exception 'ORDER_NOT_PAID' using errcode = 'P0001'; end if;
  if v_order.order_status in ('delivered', 'cancelled') then raise exception 'ORDER_FINAL' using errcode = 'P0001'; end if;
  if p_status <> 'cancelled' and (
       array_position(v_rank, p_status) is null
       or array_position(v_rank, p_status) <= array_position(v_rank, v_order.order_status)) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;
  update orders set order_status = p_status where id = p_order_id;
  perform add_order_event(p_order_id, p_status, p_note);
end $$;

-- ----------------------------------------------------------- lock it down
-- No function in this schema is callable through the public API (PostgREST). Only the table owner
-- (the server's Postgres connection) executes them.
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
