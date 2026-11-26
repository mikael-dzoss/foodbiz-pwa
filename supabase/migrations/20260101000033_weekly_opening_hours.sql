-- ============================================================================
-- Migration: 20260101000033_weekly_opening_hours.sql
-- Description: Structured weekly opening hours (#372) and exceptional days /
--              holidays (#375) per business.
--
--   Adds:
--     - `business_settings.weekly_hours` (jsonb null), validated by IMMUTABLE
--       `public.valid_weekly_hours(jsonb)` mirroring `src/domain/opening-hours.ts`
--       (7 keys mon..sun, <= 4 ranges per day, open 00:00..23:59, close
--       00:00..24:00, close > open, sorted non-overlapping non-touching;
--       COLLATE "C", no ::time casts).
--     - `business_settings.hours_exceptions` (jsonb not null default '[]'),
--       validated by IMMUTABLE `public.valid_hours_exceptions(jsonb)` (<= 100
--       non-overlapping {from, to, ranges, note?} objects, valid YYYY-MM-DD
--       dates via regex + calendar check + IMMUTABLE pg_catalog.make_date,
--       to >= from, inclusive span <= 60 days, note <= 50 chars after btrim (char_length(btrim(note)), mirrors zod trim), per-day range
--       rules matching weekly_hours; no ::time/::date casts).
--     - STABLE SQL helpers `public.is_open_at(p_hours, p_exceptions, p_tz, p_at)`
--       and `public.slot_error(p_hours, p_exceptions, p_tz, p_now, p_date, p_time,
--       p_is_asap, p_horizon_days, p_step_minutes, p_lead_minutes)` mirroring `isOpenAt` and `validateSlot` in
--       `src/domain/opening-hours.ts` for later server-side enforcement in
--       `place_order` (not touched here). Exceptions override weekly hours even
--       when weekly_hours is null; dates with neither skip opening-hour checks.
--
--     TS/SQL parity: `p_step_minutes` / `p_lead_minutes` mirror `stepMinutes` /
--     `leadMinutes` (defaults 15 / 0; step > 0 and lead >= 0 else INVALID_ARGUMENT);
--     `p_horizon_days` mirrors `horizonDays`. A `p_time` with non-zero seconds is
--     `time_outside_hours` (TS `OPEN_TIME_REGEX` only accepts HH:MM). NULL
--     `p_now` / `p_at` / `p_tz` raise INVALID_ARGUMENT (22023); never fail open.
--
--   Access: manager-editable (not owner-only) and readable by `anon` via the
--   storefront column-level SELECT grant on `business_settings`.
--   Function EXECUTE: validators -> authenticated, service_role (CHECK evaluation
--   needs EXECUTE for the writing role); is_open_at / slot_error -> service_role
--   only (place_order is SECURITY DEFINER; the storefront uses the TS domain).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.slot_error(jsonb, jsonb, text, timestamptz, date, time, boolean, integer, integer, integer);
--   drop function if exists public.is_open_at(jsonb, jsonb, text, timestamptz);
--   alter table public.business_settings drop constraint if exists business_settings_hours_exceptions_valid;
--   alter table public.business_settings drop column if exists hours_exceptions;
--   alter table public.business_settings drop constraint if exists business_settings_weekly_hours_valid;
--   alter table public.business_settings drop column if exists weekly_hours;
--   drop function if exists public.valid_hours_exceptions(jsonb);
--   drop function if exists public.valid_weekly_hours(jsonb);
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. IMMUTABLE shape & invariant validators (mirror src/domain/opening-hours.ts)
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

create or replace function public.valid_hours_exceptions(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_len integer;
  v_i integer;
  v_ex jsonb;
  v_key_count integer;
  v_has_note boolean;
  v_from text;
  v_to text;
  v_fy integer;
  v_fm integer;
  v_fd integer;
  v_ty integer;
  v_tm integer;
  v_td integer;
  v_max_day integer;
  v_ranges jsonb;
  v_range_count integer;
  v_j integer;
  v_range jsonb;
  v_range_key_count integer;
  v_open text;
  v_close text;
  v_prev_close text;
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    return false;
  end if;

  v_len := jsonb_array_length(p);
  if v_len > 100 then
    return false;
  end if;

  for v_i in 0 .. v_len - 1 loop
    v_ex := p -> v_i;
    if jsonb_typeof(v_ex) <> 'object' then
      return false;
    end if;

    v_has_note := v_ex ? 'note';
    select count(*) into v_key_count from jsonb_object_keys(v_ex);
    if v_key_count <> (case when v_has_note then 4 else 3 end)
      or not (v_ex ? 'from')
      or not (v_ex ? 'to')
      or not (v_ex ? 'ranges')
    then
      return false;
    end if;

    if jsonb_typeof(v_ex -> 'from') <> 'string'
      or jsonb_typeof(v_ex -> 'to') <> 'string'
    then
      return false;
    end if;

    v_from := v_ex ->> 'from';
    v_to := v_ex ->> 'to';

    if v_from !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      or v_to !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    then
      return false;
    end if;

    -- Validate real calendar dates without non-immutable ::date casts
    v_fy := substr(v_from, 1, 4)::integer;
    v_fm := substr(v_from, 6, 2)::integer;
    v_fd := substr(v_from, 9, 2)::integer;
    if v_fy < 1 then
      return false;
    end if;
    v_max_day := case
      when v_fm in (4, 6, 9, 11) then 30
      when v_fm = 2 then case when (v_fy % 4 = 0 and (v_fy % 100 <> 0 or v_fy % 400 = 0)) then 29 else 28 end
      else 31
    end;
    if v_fd > v_max_day then
      return false;
    end if;

    v_ty := substr(v_to, 1, 4)::integer;
    v_tm := substr(v_to, 6, 2)::integer;
    v_td := substr(v_to, 9, 2)::integer;
    if v_ty < 1 then
      return false;
    end if;
    v_max_day := case
      when v_tm in (4, 6, 9, 11) then 30
      when v_tm = 2 then case when (v_ty % 4 = 0 and (v_ty % 100 <> 0 or v_ty % 400 = 0)) then 29 else 28 end
      else 31
    end;
    if v_td > v_max_day then
      return false;
    end if;

    -- Lexicographical order on zero-padded YYYY-MM-DD (to >= from)
    if v_to collate "C" < v_from collate "C" then
      return false;
    end if;

    -- Inclusive span <= 60 days using IMMUTABLE pg_catalog.make_date & date_mi
    if (pg_catalog.make_date(v_ty, v_tm, v_td) - pg_catalog.make_date(v_fy, v_fm, v_fd)) + 1 > 60 then
      return false;
    end if;

    -- Optional note: string, <= 50 characters
    if v_has_note then
      if jsonb_typeof(v_ex -> 'note') <> 'string' or char_length(btrim(v_ex ->> 'note')) > 50 then
        return false;
      end if;
    end if;

    -- Per-day ranges: same rules as weekly_hours (<= 4, sorted, non-touching, close > open)
    v_ranges := v_ex -> 'ranges';
    if jsonb_typeof(v_ranges) <> 'array' then
      return false;
    end if;

    v_range_count := jsonb_array_length(v_ranges);
    if v_range_count > 4 then
      return false;
    end if;

    v_prev_close := null;
    for v_j in 0 .. v_range_count - 1 loop
      v_range := v_ranges -> v_j;
      if jsonb_typeof(v_range) <> 'object' then
        return false;
      end if;

      select count(*) into v_range_key_count from jsonb_object_keys(v_range);
      if v_range_key_count <> 2 or not (v_range ? 'open') or not (v_range ? 'close') then
        return false;
      end if;

      if jsonb_typeof(v_range -> 'open') <> 'string'
        or jsonb_typeof(v_range -> 'close') <> 'string'
      then
        return false;
      end if;

      v_open := v_range ->> 'open';
      v_close := v_range ->> 'close';

      if v_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
        return false;
      end if;
      if v_close !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then
        return false;
      end if;
      if not (v_close collate "C" > v_open collate "C") then
        return false;
      end if;
      if v_prev_close is not null and not (v_prev_close collate "C" < v_open collate "C") then
        return false;
      end if;

      v_prev_close := v_close;
    end loop;
  end loop;

  -- Periods must not overlap each other (adjacent days to1 + 1 = from2 are allowed).
  if v_len > 1 and exists (
    select 1
    from jsonb_array_elements(p) with ordinality as a(elem, ord)
    join jsonb_array_elements(p) with ordinality as b(elem, ord)
      on a.ord < b.ord
     and (a.elem ->> 'from') collate "C" <= (b.elem ->> 'to') collate "C"
     and (b.elem ->> 'from') collate "C" <= (a.elem ->> 'to') collate "C"
  ) then
    return false;
  end if;

  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. business_settings columns & storefront column grants
-- ----------------------------------------------------------------------------
alter table public.business_settings
  add column weekly_hours jsonb null
  constraint business_settings_weekly_hours_valid
    check (weekly_hours is null or public.valid_weekly_hours(weekly_hours));

alter table public.business_settings
  add column hours_exceptions jsonb not null default '[]'::jsonb
  constraint business_settings_hours_exceptions_valid
    check (public.valid_hours_exceptions(hours_exceptions));

-- Storefront-public column list (see 20260101000030): add weekly_hours and hours_exceptions
-- additively so grants from concurrent migrations are preserved; authenticated/service_role
-- already hold table-level privileges.
grant select (weekly_hours, hours_exceptions) on table public.business_settings to anon;

-- ----------------------------------------------------------------------------
-- 3. STABLE evaluation helpers (mirror rangesForDate, isOpenAt & validateSlot)
-- ----------------------------------------------------------------------------
create or replace function public.is_open_at(
  p_hours jsonb,
  p_exceptions jsonb,
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
  v_date_str text;
  v_day text;
  v_hhmm text;
  v_ranges jsonb;
  v_ex_ranges jsonb;
  v_has_exception boolean := false;
begin
  if p_tz is null or p_at is null then
    raise exception 'INVALID_ARGUMENT: p_tz and p_at must not be null'
      using errcode = '22023';
  end if;

  v_local := p_at at time zone p_tz;
  v_date_str := to_char(v_local, 'YYYY-MM-DD');
  v_hhmm := to_char(v_local, 'HH24:MI');

  if p_exceptions is not null and jsonb_typeof(p_exceptions) = 'array' then
    select ex -> 'ranges'
      into v_ex_ranges
    from jsonb_array_elements(p_exceptions) as ex
    where (ex ->> 'from') collate "C" <= v_date_str collate "C"
      and v_date_str collate "C" <= (ex ->> 'to') collate "C"
    limit 1;

    if found then
      v_has_exception := true;
      v_ranges := v_ex_ranges;
    end if;
  end if;

  if not v_has_exception then
    if p_hours is null then
      return true;
    end if;
    v_day := v_days[extract(isodow from v_local)::integer];
    v_ranges := p_hours -> v_day;
  end if;

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
  p_exceptions jsonb,
  p_tz text,
  p_now timestamptz,
  p_date date,
  p_time time,
  p_is_asap boolean,
  p_horizon_days integer default 30,
  p_step_minutes integer default 15,
  p_lead_minutes integer default 0
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_local_now timestamp;
  v_today date;
  v_now_min integer;
  v_date_str text;
  v_day text;
  v_ranges jsonb;
  v_ex_ranges jsonb;
  v_has_exception boolean := false;
  v_time_min integer;
  v_min_min integer;
begin
  if p_now is null or p_tz is null then
    raise exception 'INVALID_ARGUMENT: p_now and p_tz must not be null'
      using errcode = '22023';
  end if;

  if p_step_minutes is null or p_step_minutes <= 0 then
    raise exception 'INVALID_ARGUMENT: p_step_minutes must be a positive integer'
      using errcode = '22023';
  end if;

  if p_lead_minutes is null or p_lead_minutes < 0 then
    raise exception 'INVALID_ARGUMENT: p_lead_minutes must be a non-negative integer'
      using errcode = '22023';
  end if;

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

  if coalesce(p_is_asap, false) then
    if public.is_open_at(p_hours, p_exceptions, p_tz, p_now) then
      return null;
    end if;
    return 'closed_now';
  end if;

  -- Resolve ranges for p_date (mirrors rangesForDate): exception overrides weekly even if weekly is null.
  v_date_str := to_char(p_date::timestamp, 'YYYY-MM-DD');
  if p_exceptions is not null and jsonb_typeof(p_exceptions) = 'array' then
    select ex -> 'ranges'
      into v_ex_ranges
    from jsonb_array_elements(p_exceptions) as ex
    where (ex ->> 'from') collate "C" <= v_date_str collate "C"
      and v_date_str collate "C" <= (ex ->> 'to') collate "C"
    limit 1;

    if found then
      v_has_exception := true;
      v_ranges := v_ex_ranges;
    end if;
  end if;

  if not v_has_exception then
    if p_hours is null then
      return null;
    end if;
    v_day := v_days[extract(isodow from p_date)::integer];
    v_ranges := p_hours -> v_day;
  end if;

  if v_ranges is null or jsonb_typeof(v_ranges) <> 'array' or jsonb_array_length(v_ranges) = 0 then
    return 'closed_day';
  end if;

  v_now_min := extract(hour from v_local_now)::integer * 60
    + extract(minute from v_local_now)::integer;

  if p_time is not null then
    -- Parity with TS OPEN_TIME_REGEX (HH:MM only): non-zero seconds are invalid.
    if extract(second from p_time) <> 0 then
      return 'time_outside_hours';
    end if;

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

    -- Lead = 0 -> strictly after current local minute (time >= now + 1); else time >= now + lead.
    if p_date = v_today
      and v_time_min < v_now_min + (case when p_lead_minutes > 0 then p_lead_minutes else 1 end)
    then
      return 'time_in_past';
    end if;

    return null;
  end if;

  -- Time-optional scheduled order: require at least one stepped slot (p_step_minutes, p_lead_minutes)
  -- remaining on p_date. Each range [open, close) has last stepped slot:
  --   open + ((close - 1 - open) / step) * step.
  v_min_min := case
    when p_date = v_today then v_now_min + (case when p_lead_minutes > 0 then p_lead_minutes else 1 end)
    else 0
  end;

  if not exists (
    select 1
    from jsonb_array_elements(v_ranges) as r,
    lateral (
      select
        left(r ->> 'open', 2)::integer * 60 + right(r ->> 'open', 2)::integer as open_min,
        left(r ->> 'close', 2)::integer * 60 + right(r ->> 'close', 2)::integer as close_min
    ) as bounds
    where bounds.close_min > bounds.open_min
      and (bounds.open_min + ((bounds.close_min - 1 - bounds.open_min) / p_step_minutes) * p_step_minutes) >= v_min_min
  ) then
    return 'time_in_past';
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Function execute grants
-- ----------------------------------------------------------------------------
revoke all on function public.valid_weekly_hours(jsonb) from public, anon, authenticated;
grant execute on function public.valid_weekly_hours(jsonb) to authenticated, service_role;

revoke all on function public.valid_hours_exceptions(jsonb) from public, anon, authenticated;
grant execute on function public.valid_hours_exceptions(jsonb) to authenticated, service_role;

revoke all on function public.is_open_at(jsonb, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.is_open_at(jsonb, jsonb, text, timestamptz) to service_role;

revoke all on function public.slot_error(jsonb, jsonb, text, timestamptz, date, time, boolean, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.slot_error(jsonb, jsonb, text, timestamptz, date, time, boolean, integer, integer, integer) to service_role;

reset lock_timeout;
