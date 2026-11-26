-- ============================================================================
-- Migration: 20260101000035_pickup_locations.sql
-- Description: Relay pickup locations per business (#385) and the
--              `business_settings.shop_pickup_enabled` switch.
--
--   Adds:
--     - `public.pickup_locations`: name, description, address, 5-digit French
--       postcode, fee (integer cents, 0 = free), optional weekly hours (same
--       shape as `business_settings.weekly_hours`, validated by
--       `public.valid_weekly_hours`), active flag, sort order. Locations have
--       no exceptions of their own: the business closing days and holidays
--       (`hours_exceptions`) override every location's hours.
--     - At most 20 locations per business (BEFORE INSERT trigger, serialised
--       per business with an advisory transaction lock).
--     - business_id immutability, "at least one active pickup option" and an atomic
--       reorder function (sections 2b, 6, 7).
--     - RLS: anon and authenticated read ACTIVE rows (storefront); members of
--       the business read all their rows and insert/update/delete their own.
--     - Explicit table grants (no reliance on default privileges).
--     - `business_settings.shop_pickup_enabled` (default true) readable by anon.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   alter table public.business_settings drop column if exists shop_pickup_enabled;
--   drop table if exists public.pickup_locations;
--   drop function if exists public.enforce_pickup_locations_limit();
--   drop function if exists public.enforce_pickup_option_available();
--   drop function if exists public.forbid_pickup_location_business_change();
--   drop function if exists public.reorder_pickup_locations(uuid, uuid[]);
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------
create table public.pickup_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null
    constraint pickup_locations_name_length check (char_length(name) between 1 and 80 and name = btrim(name)),
  description text null
    constraint pickup_locations_description_length check (char_length(description) <= 200),
  address text not null
    constraint pickup_locations_address_length check (char_length(address) between 1 and 200),
  postcode text not null
    constraint pickup_locations_postcode_format check (postcode ~ '^[0-9]{5}$'),
  fee_cents integer not null default 0
    constraint pickup_locations_fee_range check (fee_cents between 0 and 10000),
  weekly_hours jsonb null
    constraint pickup_locations_weekly_hours_valid
      check (weekly_hours is null or public.valid_weekly_hours(weekly_hours)),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_locations_business_id_id_key unique (business_id, id)
);

create index idx_pickup_locations_business_sort
  on public.pickup_locations (business_id, sort_order);

create trigger trigger_pickup_locations_updated_at
  before update on public.pickup_locations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Limit: at most 20 locations per business
-- ----------------------------------------------------------------------------
create or replace function public.enforce_pickup_locations_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Relies on READ COMMITTED (the default): after the advisory lock is acquired the count
  -- statement takes a fresh snapshot, so it sees rows committed by the previous holder.
  -- Serialise concurrent inserts for the same business so the count is stable.
  perform pg_advisory_xact_lock(hashtextextended('pickup_locations:' || new.business_id::text, 0));

  if (select count(*) from public.pickup_locations where business_id = new.business_id) >= 20 then
    raise exception 'PICKUP_LOCATIONS_LIMIT: a business can have at most 20 pickup locations'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_pickup_locations_limit() from public;

create trigger trigger_pickup_locations_limit
  before insert on public.pickup_locations
  for each row execute function public.enforce_pickup_locations_limit();

-- ----------------------------------------------------------------------------
-- 2b. business_id is immutable (a location cannot be moved between businesses)
-- ----------------------------------------------------------------------------
create or replace function public.forbid_pickup_location_business_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'pickup_locations.business_id is immutable'
    using errcode = '42501';
end;
$$;

revoke all on function public.forbid_pickup_location_business_change() from public;

create trigger trigger_pickup_locations_business_immutable
  before update of business_id on public.pickup_locations
  for each row
  when (old.business_id is distinct from new.business_id)
  execute function public.forbid_pickup_location_business_change();

-- ----------------------------------------------------------------------------
-- 3. RLS
-- ----------------------------------------------------------------------------
alter table public.pickup_locations enable row level security;

create policy pickup_locations_select_anon
  on public.pickup_locations for select to anon
  using (is_active);

create policy pickup_locations_select_authenticated
  on public.pickup_locations for select to authenticated
  using (is_active or public.is_business_member(business_id));

create policy pickup_locations_insert_authenticated
  on public.pickup_locations for insert to authenticated
  with check (public.is_business_member(business_id));

create policy pickup_locations_update_authenticated
  on public.pickup_locations for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy pickup_locations_delete_authenticated
  on public.pickup_locations for delete to authenticated
  using (public.is_business_member(business_id));

-- ----------------------------------------------------------------------------
-- 4. Explicit grants (see 20260101000030)
-- ----------------------------------------------------------------------------
revoke all on table public.pickup_locations from anon, authenticated, service_role;

grant select on table public.pickup_locations to anon;
grant select, insert, update, delete on table public.pickup_locations to authenticated;
grant select, insert, update, delete on table public.pickup_locations to service_role;

-- ----------------------------------------------------------------------------
-- 5. business_settings.shop_pickup_enabled
-- ----------------------------------------------------------------------------
alter table public.business_settings
  add column shop_pickup_enabled boolean not null default true;

-- Storefront-public column (additive, like weekly_hours in 20260101000033).
grant select (shop_pickup_enabled) on table public.business_settings to anon;

-- ----------------------------------------------------------------------------
-- 6. At least one pickup option must stay available (enforced in the database)
--    While the pickup service type is on, either the shop itself
--    (`shop_pickup_enabled`) or an active relay location must remain. Checked
--    AFTER the change, under a per-business advisory lock so concurrent
--    deactivations/deletes/toggles serialise (READ COMMITTED: the re-count after
--    the lock sees the previous holder's committed change).
-- ----------------------------------------------------------------------------
create or replace function public.enforce_pickup_option_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_pickup_on boolean;
  v_shop_on boolean;
begin
  if tg_table_name = 'pickup_locations' then
    v_business_id := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
  else
    v_business_id := new.business_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('pickup_options:' || v_business_id::text, 0));

  select coalesce((bs.service_types->>'pickup')::boolean, false), bs.shop_pickup_enabled
    into v_pickup_on, v_shop_on
    from public.business_settings bs
   where bs.business_id = v_business_id;

  -- No settings row (e.g. the business is being deleted by cascade): nothing to protect.
  if not found or not v_pickup_on or v_shop_on then
    return null;
  end if;

  -- Skip when the business row itself is being deleted (cascade).
  if not exists (select 1 from public.businesses b where b.id = v_business_id) then
    return null;
  end if;

  if not exists (
    select 1 from public.pickup_locations pl
     where pl.business_id = v_business_id and pl.is_active
  ) then
    raise exception 'LAST_PICKUP_OPTION: pickup needs at least one active option'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function public.enforce_pickup_option_available() from public;

create trigger trigger_pickup_locations_option_available
  after update of is_active or delete on public.pickup_locations
  for each row execute function public.enforce_pickup_option_available();

create trigger trigger_business_settings_pickup_option_available
  after update of shop_pickup_enabled, service_types on public.business_settings
  for each row execute function public.enforce_pickup_option_available();

-- ----------------------------------------------------------------------------
-- 7. Atomic reorder (security invoker: RLS applies)
-- ----------------------------------------------------------------------------
create or replace function public.reorder_pickup_locations(p_business_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_ids is null
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or (select count(*) from public.pickup_locations where business_id = p_business_id)
          <> cardinality(p_ids)
     or exists (
       select 1 from unnest(p_ids) x
        where not exists (
          select 1 from public.pickup_locations pl
           where pl.id = x and pl.business_id = p_business_id
        )
     )
  then
    raise exception 'PICKUP_REORDER_MISMATCH: ids must be exactly the business pickup locations'
      using errcode = '22023';
  end if;

  update public.pickup_locations pl
     set sort_order = o.position - 1
    from unnest(p_ids) with ordinality as o(id, position)
   where pl.id = o.id and pl.business_id = p_business_id;
end;
$$;

revoke all on function public.reorder_pickup_locations(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_pickup_locations(uuid, uuid[]) to authenticated, service_role;

reset lock_timeout;
