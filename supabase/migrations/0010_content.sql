-- Storefront content managed from the admin panel: homepage banners, structured homepage sections, static pages,
-- FAQs and the footer. The storefront reads only published/active/visible rows; staff changes arrive through the
-- admin API (server side), never from a browser. Seeds reproduce the content the storefront already shows, so
-- switching to the CMS changes nothing until someone edits it. No company details are invented.

-- ---------------------------------------------------------------- banners
create table if not exists public.homepage_banners (
  id                  uuid primary key default gen_random_uuid(),
  heading             text not null check (char_length(btrim(heading)) between 1 and 120),
  subtitle            text not null default '' check (char_length(subtitle) <= 240),
  cta_label           text not null default '' check (char_length(cta_label) <= 40),
  cta_href            text not null default '' check (cta_href = '' or cta_href ~ '^(/|#|https://)[^\s]*$'),
  desktop_image_url   text,
  mobile_image_url    text,
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  starts_at           timestamptz,
  ends_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint homepage_banners_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists homepage_banners_order_idx on public.homepage_banners (sort_order, created_at);
drop trigger if exists homepage_banners_updated_at on public.homepage_banners;
create trigger homepage_banners_updated_at before update on public.homepage_banners
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- sections
create table if not exists public.cms_sections (
  key         text primary key check (key in ('hero', 'promo_strip', 'featured_products', 'brand_intro', 'why_choose', 'benefits', 'support')),
  title       text not null default '' check (char_length(title) <= 120),
  body        text not null default '' check (char_length(body) <= 1000),
  cta_label   text not null default '' check (char_length(cta_label) <= 40),
  cta_href    text not null default '' check (cta_href = '' or cta_href ~ '^(/|#|https://)[^\s]*$'),
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 8),
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);
drop trigger if exists cms_sections_updated_at on public.cms_sections;
create trigger cms_sections_updated_at before update on public.cms_sections
  for each row execute function public.set_updated_at();

insert into public.cms_sections (key, title, body, cta_label, cta_href, items, is_visible, sort_order) values
  ('hero', 'A cleaner home starts here.', 'Pick your essentials and order in a few taps.', 'Shop Products', '#products', '[]', true, 0),
  -- {threshold} is replaced by the live free-delivery threshold from Delivery settings.
  ('promo_strip', 'Free delivery on orders above {threshold}.', '', '', '', '[]', true, 10),
  ('featured_products', 'Featured products', '', '', '', '[]', true, 20),
  ('brand_intro', 'About us', '', '', '', '[]', false, 30),
  ('why_choose', 'Why order with us', '', '', '', jsonb_build_array(
      jsonb_build_object('title', 'Secure online payment', 'text', 'UPI, cards and netbanking. No account needed.'),
      jsonb_build_object('title', 'Track in the Orders tab', 'text', 'See every order''s status in one place.'),
      jsonb_build_object('title', 'Help when you need it', 'text', 'Reach support from your profile.')), true, 40),
  ('benefits', 'Customer benefits', '', '', '', '[]', false, 50),
  ('support', 'Need help?', 'Our team is happy to help with orders and products.', 'Contact support', '/help#contact', '[]', false, 60)
on conflict (key) do nothing;

-- ------------------------------------------------------------------- pages
create table if not exists public.cms_pages (
  slug             text primary key check (slug in ('about', 'contact', 'privacy', 'terms', 'shipping', 'refund')),
  title            text not null check (char_length(btrim(title)) between 1 and 120),
  content_md       text not null default '' check (char_length(content_md) <= 60000),
  seo_title        text not null default '' check (char_length(seo_title) <= 120),
  seo_description  text not null default '' check (char_length(seo_description) <= 320),
  status           text not null default 'draft' check (status in ('draft', 'published')),
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
drop trigger if exists cms_pages_updated_at on public.cms_pages;
create trigger cms_pages_updated_at before update on public.cms_pages
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------- faqs
create table if not exists public.faqs (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'General' check (char_length(btrim(category)) between 1 and 40),
  question    text not null check (char_length(btrim(question)) between 3 and 200),
  answer      text not null check (char_length(btrim(answer)) between 1 and 2000),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists faqs_order_idx on public.faqs (sort_order, created_at);
drop trigger if exists faqs_updated_at on public.faqs;
create trigger faqs_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();

-- The questions the Help page has always shown, seeded once (only into an empty table).
insert into public.faqs (category, question, answer, sort_order)
select 'Orders', q, a, n from (values
  (10, 'How do I place an order?', 'Add products to your cart and check out as a guest or with an account. There are three steps: delivery details, review and online payment, then confirmation once your payment is verified.'),
  (20, 'How can I track my order?', 'Signed in: open the Orders tab. Guest: use the private tracking link shown after you pay, or the Track page with your order number and tracking code. Each order shows its status and a timeline.'),
  (30, 'Which payment methods are available?', 'We accept online payment only (no Cash on Delivery). Your order is confirmed once the payment is verified. If a payment fails you can retry it without losing your cart.'),
  (40, 'What are the delivery charges?', 'Delivery charges and free-delivery rules are shown in your cart and at checkout before you pay.'),
  (50, 'Can I change or cancel an order?', 'Order changes are not available in the app yet. Please contact support with your order number.')
) as seed(n, q, a)
where not exists (select 1 from public.faqs);

-- ------------------------------------------------------------------ footer
insert into public.store_settings (key, value, is_public) values
  ('footer', jsonb_build_object(
      'description', '',
      'usefulLinks', jsonb_build_array(
        jsonb_build_object('label', 'My Orders', 'href', '/orders'),
        jsonb_build_object('label', 'Profile', 'href', '/profile'),
        jsonb_build_object('label', 'Help & Support', 'href', '/help'),
        jsonb_build_object('label', 'Cart', 'href', '/cart')),
      'policyLinks', jsonb_build_array(
        jsonb_build_object('label', 'Privacy Policy', 'href', '/privacy'),
        jsonb_build_object('label', 'Terms & Conditions', 'href', '/terms')),
      'socialLinks', '[]'::jsonb,
      'copyright', ''), true)
on conflict (key) do nothing;

-- ------------------------------------------------------------- RLS / grants
alter table public.homepage_banners enable row level security;
alter table public.cms_sections     enable row level security;
alter table public.cms_pages        enable row level security;
alter table public.faqs             enable row level security;
revoke all on public.homepage_banners, public.cms_sections, public.cms_pages, public.faqs from anon, authenticated;

grant select on public.homepage_banners, public.cms_sections, public.cms_pages, public.faqs to anon, authenticated;
drop policy if exists banners_public_read on public.homepage_banners;
create policy banners_public_read on public.homepage_banners for select to anon, authenticated
  using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
drop policy if exists sections_public_read on public.cms_sections;
create policy sections_public_read on public.cms_sections for select to anon, authenticated using (is_visible);
drop policy if exists pages_public_read on public.cms_pages;
create policy pages_public_read on public.cms_pages for select to anon, authenticated using (status = 'published');
drop policy if exists faqs_public_read on public.faqs;
create policy faqs_public_read on public.faqs for select to anon, authenticated using (is_active);

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
