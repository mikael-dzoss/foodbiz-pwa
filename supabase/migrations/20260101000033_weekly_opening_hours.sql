-- ============================================================================
-- Migration: 20260101000033_weekly_opening_hours.sql
-- Description: Structured weekly opening hours per business (#372).
--
--   Adds nullable `business_settings.weekly_hours` (jsonb) validated by an
--   IMMUTABLE helper `public.valid_weekly_hours(jsonb)` mirroring the exact
--   constants and rules of `src/domain/opening-hours.ts` (7 keys mon..sun,
--   <= 4 ranges per day, open 00:00..23:59, close 00:00..24:00, close > open,
--   sorted non-overlapping non-touching; zero-padded string comparisons with
--   COLLATE "C", no ::time casts so the function stays genuinely IMMUTABLE).
--
--   Also adds STABLE SQL helpers `public.is_open_at` and `public.slot_error`
--   mirroring `isOpenAt` and `validateSlot` in `src/domain/opening-hours.ts`
--   for later server-side enforcement in `place_order` (not touched here).
--
--   Access: manager-editable (not owner-only) and readable by `anon` via the
--   storefront column-level SELECT grant on `business_settings`.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.slot_error(jsonb, text, timestamptz, date, time, boolean, integer);
--   drop function if exists public.is_open_at(jsonb, text, timestamptz);
--   alter table public.business_settings drop constraint if exists business_settings_weekly_hours_valid;
--   alter table public.business_settings drop column if exists weekly_hours;
--   drop function if exists public.valid_weekly_hours(jsonb);
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. IMMUTABLE shape & invariant validator (mirrors src/domain/opening-hours.ts)
-- ----------------------------------------------------------------------------
create or replace function public.valid_weekly_hours(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_key_count integer;
  v_day text;
  v_ranges jsonb;
  v_range_count integer;
  v_i integer;
  v_range jsonb;
  v_range_key_count integer;
  v_open_json jsonb;
  v_close_json jsonb;
  v_open text;
  v_close text;
  v_prev_close text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return false;
  end if;

  select count(*) into v_key_count from jsonb_object_keys(p);
  if v_key_count <> 7 then
    return false;
  end if;

  foreach v_day in array v_days loop
    if not (p ? v_day) then
      return false;
    end if;

    v_ranges := p -> v_day;
    if jsonb_typeof(v_ranges) <> 'array' then
      return false;
    end if;

    v_range_count := jsonb_array_length(v_ranges);
    if v_range_count > 4 then
      return false;
    end if;

    v_prev_close := null;
    for v_i in 0 .. v_range_count - 1 loop
      v_range := v_ranges -> v_i;
      if jsonb_typeof(v_range) <> 'object' then
        return false;
      end if;

      select count(*) into v_range_key_count from jsonb_object_keys(v_range);
      if v_range_key_count <> 2 or not (v_range ? 'open') or not (v_range ? 'close') then
        return false;
      end if;

      v_open_json := v_range -> 'open';
      v_close_json := v_range -> 'close';
      if jsonb_typeof(v_open_json) <> 'string' or jsonb_typeof(v_close_json) <> 'string' then
        return false;
      end if;

      v_open := v_range ->> 'open';
      v_close := v_range ->> 'close';

      -- OPEN_TIME_REGEX: 00:00..23:59; CLOSE_TIME_REGEX: 00:00..23:59 or 24:00
      if v_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        return false;
      end if;
      if v_close !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then
        return false;
      end if;

      -- Zero-padded HH:MM ASCII ordering (no ::time cast; locale-independent via COLLATE "C")
      if not (v_close collate "C" > v_open collate "C") then
        return false;
      end if;

      -- Strictly sorted, non-overlapping, and non-touching (prev.close < next.open)
      if v_prev_close is not null and not (v_prev_close collate "C" < v_open collate "C") then
        return false;
      end if;

      v_prev_close := v_close;
    end loop;
  end loop;

  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Nullable business_settings.weekly_hours column & storefront column grant
-- ----------------------------------------------------------------------------
alter table public.business_settings
  add column weekly_hours jsonb null
  constraint business_settings_weekly_hours_valid
    check (weekly_hours is null or public.valid_weekly_hours(weekly_hours));

-- Storefront-public column list (see 20260101000030): add weekly_hours additively so
-- grants from concurrent migrations are preserved; authenticated/service_role already
-- hold table-level privileges.
grant select (weekly_hours) on table public.business_settings to anon;

-- ----------------------------------------------------------------------------
-- 3. STABLE evaluation helpers (mirror isOpenAt & validateSlot in domain)
-- ----------------------------------------------------------------------------
create or replace function public.is_open_at(
  p_hours jsonb,
  p_tz text,
  p_at timestamptz
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_local timestamp;
  v_day text;
  v_hhmm text;
  v_ranges jsonb;
begin
  if p_hours is null then
    return true;
  end if;

  if p_tz is null or p_at is null then
    return false;
  end if;

  v_local := p_at at time zone p_tz;
  v_day := v_days[extract(isodow from v_local)::integer];
  v_hhmm := to_char(v_local, 'HH24:MI');
  v_ranges := p_hours -> v_day;

  if v_ranges is null or jsonb_typeof(v_ranges) <> 'array' then
    return false;
  end if;

  return exists (
    select 1
    from jsonb_array_elements(v_ranges) as r
    where (r ->> 'open') collate "C" <= v_hhmm collate "C"
      and v_hhmm collate "C" < (r ->> 'close') collate "C"
  );
end;
$$;

create or replace function public.slot_error(
  p_hours jsonb,
  p_tz text,
  p_now timestamptz,
  p_date date,
  p_time time,
  p_is_asap boolean,
  p_horizon_days integer default 30
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_step constant integer := 15;
  v_local_now timestamp;
  v_today date;
  v_now_min integer;
  v_day text;
  v_ranges jsonb;
  v_time_min integer;
  v_min_min integer;
begin
  if p_horizon_days is null or p_horizon_days < 0 then
    raise exception 'INVALID_HORIZON_DAYS: horizon must be a non-negative integer'
      using errcode = '22023';
  end if;

  v_local_now := p_now at time zone p_tz;
  v_today := v_local_now::date;

  -- Booking window [today, today + horizon] always applies, even when weekly_hours is null.
  if p_date is null or p_date < v_today or p_date > (v_today + p_horizon_days) then
    return 'date_out_of_window';
  end if;

  if p_hours is null then
    return null;
  end if;

  if coalesce(p_is_asap, false) then
    if public.is_open_at(p_hours, p_tz, p_now) then
      return null;
    end if;
    return 'closed_now';
  end if;

  v_day := v_days[extract(isodow from p_date)::integer];
  v_ranges := p_hours -> v_day;
  if v_ranges is null or jsonb_typeof(v_ranges) <> 'array' or jsonb_array_length(v_ranges) = 0 then
    return 'closed_day';
  end if;

  v_now_min := extract(hour from v_local_now)::integer * 60
    + extract(minute from v_local_now)::integer;

  if p_time is not null then
    v_time_min := extract(hour from p_time)::integer * 60
      + extract(minute from p_time)::integer;

    -- Half-open [open, close) check first (24:00:00 -> 1440, always outside [open, close)).
    if not exists (
      select 1
      from jsonb_array_elements(v_ranges) as r
      where (left(r ->> 'open', 2)::integer * 60 + right(r ->> 'open', 2)::integer) <= v_time_min
        and v_time_min < (left(r ->> 'close', 2)::integer * 60 + right(r ->> 'close', 2)::integer)
    ) then
      return 'time_outside_hours';
    end if;

    -- Lead = 0 -> strictly after current local minute on today (time >= now + 1).
    if p_date = v_today and v_time_min <= v_now_min then
      return 'time_in_past';
    end if;

    return null;
  end if;

  -- Time-optional scheduled order: require at least one stepped slot (step = 15, lead = 0)
  -- remaining on p_date. Each range [open, close) has last stepped slot:
  --   open + ((close - 1 - open) / step) * step.
  v_min_min := case when p_date = v_today then v_now_min + 1 else 0 end;

  if not exists (
    select 1
    from jsonb_array_elements(v_ranges) as r,
    lateral (
      select
        left(r ->> 'open', 2)::integer * 60 + right(r ->> 'open', 2)::integer as open_min,
        left(r ->> 'close', 2)::integer * 60 + right(r ->> 'close', 2)::integer as close_min
    ) as bounds
    where bounds.close_min > bounds.open_min
      and (bounds.open_min + ((bounds.close_min - 1 - bounds.open_min) / v_step) * v_step) >= v_min_min
  ) then
    return 'time_in_past';
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Function execute grants
-- ----------------------------------------------------------------------------
revoke all on function public.valid_weekly_hours(jsonb) from public;
grant execute on function public.valid_weekly_hours(jsonb) to anon, authenticated, service_role;

revoke all on function public.is_open_at(jsonb, text, timestamptz) from public;
grant execute on function public.is_open_at(jsonb, text, timestamptz) to anon, authenticated, service_role;

revoke all on function public.slot_error(jsonb, text, timestamptz, date, time, boolean, integer) from public;
grant execute on function public.slot_error(jsonb, text, timestamptz, date, time, boolean, integer) to anon, authenticated, service_role;

reset lock_timeout;
