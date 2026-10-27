-- Business settings managed from the admin panel: store details, delivery rules, contact, notification switches.
-- `is_public` rows are what the storefront may read (delivery fee, contact numbers); private rows are server-only.
-- Contact fields are seeded EMPTY on purpose: no company details are invented.

create table if not exists public.store_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  value       jsonb not null default '{}'::jsonb check (jsonb_typeof(value) = 'object'),
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
drop trigger if exists store_settings_updated_at on public.store_settings;
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

insert into public.store_settings (key, value, is_public) values
  ('store', jsonb_build_object(
      'businessName', 'SuperWalls', 'tagline', '', 'logoUrl', null, 'contactEmail', '', 'contactPhone', '',
      'address', '', 'websiteUrl', '', 'currency', 'INR', 'timezone', 'Asia/Kolkata'), true),
  -- Same numbers the storefront has always shown (placeholders until the owner sets the real policy).
  ('delivery', jsonb_build_object(
      'deliveryFeePaise', 4900, 'freeDeliveryThresholdPaise', 49900, 'minOrderPaise', 0,
      'serviceablePincodes', '[]'::jsonb, 'serviceableCities', '[]'::jsonb, 'policyText', ''), true),
  ('contact', jsonb_build_object(
      'supportPhone', '', 'supportEmail', '', 'whatsappNumber', '', 'availability', ''), true),
  -- Future notifications. These switches record intent only: nothing is sent in this phase.
  ('notifications', jsonb_build_object(
      'orderConfirmation', false, 'orderProcessing', false, 'shippingUpdates', false, 'deliveryUpdates', false, 'lowStockAlerts', false), false)
on conflict (key) do nothing;

alter table public.store_settings enable row level security;
revoke all on public.store_settings from anon, authenticated;
grant select on public.store_settings to anon, authenticated;
drop policy if exists store_settings_public_read on public.store_settings;
create policy store_settings_public_read on public.store_settings for select
  to anon, authenticated using (is_public);

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
