-- Admin CMS access control: who is staff, what each role may do, and an append-only audit log.
--
-- Admin identity lives ONLY in `admin_members` (never in user-editable auth metadata). Customers never get a row
-- here automatically; rows come from the bootstrap script or a super-admin's invitation. The role -> permission
-- matrix is data (table `admin_role_permissions`), re-seeded by this file, so it has a single source of truth.
-- Everything here is server-side only: RLS is on and nothing is granted to anon / authenticated.

-- ------------------------------------------------------------------ role matrix
create table if not exists public.admin_role_permissions (
  role        text not null check (role in ('super_admin', 'manager', 'order_manager', 'content_manager', 'inventory_manager')),
  permission  text not null,
  primary key (role, permission)
);

delete from public.admin_role_permissions;
insert into public.admin_role_permissions (role, permission)
select p.role, p.permission
from (values
  -- Super admin: everything, including the security-sensitive areas.
  ('super_admin', 'dashboard.view'), ('super_admin', 'catalog.read'), ('super_admin', 'catalog.write'),
  ('super_admin', 'catalog.delete'), ('super_admin', 'orders.read'), ('super_admin', 'orders.update'),
  ('super_admin', 'orders.export'), ('super_admin', 'customers.read'), ('super_admin', 'customers.update'),
  ('super_admin', 'inventory.read'), ('super_admin', 'inventory.adjust'), ('super_admin', 'promotions.read'),
  ('super_admin', 'promotions.write'), ('super_admin', 'content.read'), ('super_admin', 'content.write'),
  ('super_admin', 'reports.view'), ('super_admin', 'reports.export'), ('super_admin', 'settings.manage'),
  ('super_admin', 'team.manage'), ('super_admin', 'activity.view'),
  -- Manager: runs the business day to day. No settings, team or audit log.
  ('manager', 'dashboard.view'), ('manager', 'catalog.read'), ('manager', 'catalog.write'),
  ('manager', 'catalog.delete'), ('manager', 'orders.read'), ('manager', 'orders.update'),
  ('manager', 'orders.export'), ('manager', 'customers.read'), ('manager', 'customers.update'),
  ('manager', 'inventory.read'), ('manager', 'inventory.adjust'), ('manager', 'promotions.read'),
  ('manager', 'promotions.write'), ('manager', 'content.read'), ('manager', 'content.write'),
  ('manager', 'reports.view'), ('manager', 'reports.export'),
  -- Order manager: fulfilment only. Sees customer/delivery data solely through the orders they process.
  ('order_manager', 'dashboard.view'), ('order_manager', 'orders.read'), ('order_manager', 'orders.update'),
  -- Content manager: storefront content. No customer or financial data.
  ('content_manager', 'dashboard.view'), ('content_manager', 'content.read'), ('content_manager', 'content.write'),
  ('content_manager', 'catalog.read'),
  -- Inventory manager: stock only.
  ('inventory_manager', 'dashboard.view'), ('inventory_manager', 'catalog.read'),
  ('inventory_manager', 'inventory.read'), ('inventory_manager', 'inventory.adjust')
) as p(role, permission);

-- --------------------------------------------------------------------- members
create table if not exists public.admin_members (
  id                 uuid primary key default gen_random_uuid(),
  -- Null until an invited person signs in with the invited, Supabase-verified email.
  user_id            uuid unique references auth.users (id) on delete cascade,
  email              text not null,
  display_name       text not null default '',
  role               text not null check (role in ('super_admin', 'manager', 'order_manager', 'content_manager', 'inventory_manager')),
  status             text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'revoked')),
  invited_by         uuid references auth.users (id) on delete set null,
  invited_at         timestamptz not null default now(),
  invite_expires_at  timestamptz,
  activated_at       timestamptz,
  last_login_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint admin_members_bound check (status not in ('active', 'suspended') or user_id is not null)
);
-- One live record per email; revoked rows stay as history.
create unique index if not exists admin_members_email_live_uq
  on public.admin_members (lower(email)) where status in ('invited', 'active', 'suspended');
drop trigger if exists admin_members_updated_at on public.admin_members;
create trigger admin_members_updated_at before update on public.admin_members
  for each row execute function public.set_updated_at();

-- The last active super admin can never be demoted, suspended, revoked or deleted, even by a race.
create or replace function public.admin_members_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_others integer;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'super_admin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'super_admin' or new.status <> 'active') then
    perform pg_advisory_xact_lock(hashtext('admin_members_super_guard'));
    select count(*) into v_others from admin_members
      where role = 'super_admin' and status = 'active' and id <> old.id;
    if v_others = 0 then
      raise exception 'LAST_SUPER_ADMIN' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists admin_members_guard on public.admin_members;
create trigger admin_members_guard before update or delete on public.admin_members
  for each row execute function public.admin_members_guard();

-- ------------------------------------------------------------------ audit log
-- No foreign key on purpose: history must survive the removal of a user. Rows can never change.
create table if not exists public.admin_activity_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid,
  actor_email   text,
  action        text not null,
  entity_type   text,
  entity_id     text,
  summary       text not null default '',
  metadata      jsonb not null default '{}'::jsonb,
  ip            text,
  created_at    timestamptz not null default now()
);
create index if not exists admin_logs_created_idx on public.admin_activity_logs (created_at desc);
create index if not exists admin_logs_entity_idx on public.admin_activity_logs (entity_type, entity_id);
create index if not exists admin_logs_actor_idx on public.admin_activity_logs (actor_id, created_at desc);

create or replace function public.admin_logs_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE' using errcode = 'P0001';
end $$;
drop trigger if exists admin_logs_no_change on public.admin_activity_logs;
create trigger admin_logs_no_change before update or delete on public.admin_activity_logs
  for each row execute function public.admin_logs_immutable();
drop trigger if exists admin_logs_no_truncate on public.admin_activity_logs;
create trigger admin_logs_no_truncate before truncate on public.admin_activity_logs
  for each statement execute function public.admin_logs_immutable();

create or replace function public.log_admin_activity(
  p_actor uuid, p_actor_email text, p_action text, p_entity_type text, p_entity_id text,
  p_summary text, p_metadata jsonb, p_ip text
) returns void language sql set search_path = public as $$
  insert into admin_activity_logs (actor_id, actor_email, action, entity_type, entity_id, summary, metadata, ip)
  values (p_actor, p_actor_email, p_action, p_entity_type, p_entity_id, left(coalesce(p_summary, ''), 500),
          coalesce(p_metadata, '{}'::jsonb), left(p_ip, 64))
$$;

-- ----------------------------------------------------------------- authorization
create or replace function public.admin_permissions(p_user uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(rp.permission order by rp.permission), '{}'::text[])
  from admin_members m join admin_role_permissions rp on rp.role = m.role
  where m.user_id = p_user and m.status = 'active'
$$;

create or replace function public.admin_has_permission(p_user uuid, p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_permission = any (admin_permissions(p_user))
$$;

-- Called after Supabase Auth accepted the password. Returns the active member, a {status} for suspended /
-- revoked accounts, or null for anyone who is not staff. An invitation is bound to the account only when the
-- caller passes an email that Supabase has VERIFIED (null otherwise), so nobody can claim an invite by typing it.
create or replace function public.admin_resolve_login(p_user_id uuid, p_verified_email text)
returns jsonb language plpgsql set search_path = public as $$
declare
  m admin_members%rowtype;
begin
  select * into m from admin_members where user_id = p_user_id for update;
  if found then
    if m.status <> 'active' then
      return jsonb_build_object('status', m.status);
    end if;
    update admin_members set last_login_at = now() where id = m.id returning * into m;
  else
    if p_verified_email is null then return null; end if;
    select * into m from admin_members
      where lower(email) = lower(p_verified_email) and status = 'invited' and user_id is null
        and (invite_expires_at is null or invite_expires_at > now())
      for update;
    if not found then return null; end if;
    update admin_members set user_id = p_user_id, status = 'active', activated_at = now(), last_login_at = now()
      where id = m.id returning * into m;
  end if;
  return jsonb_build_object('status', 'active', 'memberId', m.id, 'role', m.role, 'displayName', m.display_name);
end $$;

-- Super-admin operations. Each re-checks the actor's permission itself, so a bug in the app layer cannot bypass it.
create or replace function public.admin_invite_member(
  p_actor uuid, p_email text, p_role text, p_name text, p_trust_verified boolean
) returns jsonb language plpgsql set search_path = public as $$
declare
  u record;
  m admin_members%rowtype;
begin
  if not admin_has_permission(p_actor, 'team.manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if exists (select 1 from admin_members where lower(email) = lower(p_email) and status in ('invited', 'active', 'suspended')) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  select id, email_confirmed_at into u from auth.users where lower(email) = lower(p_email) limit 1;
  if found and u.email_confirmed_at is not null and p_trust_verified then
    insert into admin_members (user_id, email, display_name, role, status, invited_by, activated_at)
      values (u.id, lower(p_email), coalesce(p_name, ''), p_role, 'active', p_actor, now())
      returning * into m;
  else
    insert into admin_members (email, display_name, role, status, invited_by, invite_expires_at)
      values (lower(p_email), coalesce(p_name, ''), p_role, 'invited', p_actor, now() + interval '7 days')
      returning * into m;
  end if;
  return jsonb_build_object('id', m.id, 'status', m.status);
end $$;

create or replace function public.admin_update_member(
  p_actor uuid, p_member_id uuid, p_role text, p_status text
) returns jsonb language plpgsql set search_path = public as $$
declare
  m admin_members%rowtype;
begin
  if not admin_has_permission(p_actor, 'team.manage') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into m from admin_members where id = p_member_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if m.user_id is not distinct from p_actor then
    -- Nobody edits their own access: no self-promotion, and no accidental self-lockout.
    raise exception 'SELF_CHANGE' using errcode = 'P0001';
  end if;
  if m.status = 'revoked' then raise exception 'MEMBER_REVOKED' using errcode = 'P0001'; end if;
  if p_status = 'active' and m.user_id is null then raise exception 'NOT_ACCEPTED' using errcode = 'P0001'; end if;
  if p_status = 'suspended' and m.user_id is null then raise exception 'NOT_ACCEPTED' using errcode = 'P0001'; end if;

  update admin_members set role = coalesce(p_role, role), status = coalesce(p_status, status)
    where id = p_member_id returning * into m;
  return jsonb_build_object('id', m.id, 'role', m.role, 'status', m.status);
end $$;

-- --------------------------------------------------------------------- lockdown
alter table public.admin_role_permissions enable row level security;
alter table public.admin_members          enable row level security;
alter table public.admin_activity_logs    enable row level security;
revoke all on public.admin_role_permissions, public.admin_members, public.admin_activity_logs from anon, authenticated;

-- Same rule as migration 0003: no function in this schema is callable through the public API.
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
