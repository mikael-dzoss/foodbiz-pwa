-- ============================================================================
-- Migration: 20260101000029_business_timezone.sql
-- Description: The business operating time zone (#168, audit finding B9). Until now every
--   date was computed and rendered in the server's UTC (KPI day boundaries, "today", opening
--   hours, order timestamps), so a shop in Paris saw "today" end at 01:00/02:00 local time and
--   the server and the browser rendered different times.
--
--   business_settings.timezone: an IANA zone name, default 'Europe/Paris' (the only currency is
--   EUR, so the shop is in the euro area; managers can change it). The column default makes the
--   migration safe on existing data: every existing row gets Europe/Paris, no backfill needed.
--
--   Validation: a CHECK constraint cannot look the name up (pg_timezone_names is a view, so a
--   wrapper function could not honestly be declared IMMUTABLE, and a lying IMMUTABLE function
--   breaks dump/restore). A BEFORE INSERT/UPDATE trigger checks the name against
--   pg_timezone_names instead. It only runs when the value is new or changed, so unrelated
--   settings updates never pay for the lookup.
--
--   Access: manager-editable like the other ordering columns (no owner-only rule), and readable
--   by anon because the public storefront formats pickup times, order tracking and the opening
--   hours status in the shop's zone (column grant extended, see public_surface tests).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   -- Trigger-only function: nobody calls it directly (same as enforce_owner_only_columns in 028).
revoke all on function public.validate_business_timezone() from public, anon, authenticated;

drop trigger if exists business_settings_validate_timezone on public.business_settings;
--   drop function if exists public.validate_business_timezone();
--   alter table public.business_settings drop column timezone;
--   (and re-grant anon select without the timezone column).
-- ============================================================================

set lock_timeout = '5s';

alter table public.business_settings
  add column if not exists timezone text not null default 'Europe/Paris';

create or replace function public.validate_business_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.timezone is not distinct from old.timezone then
    return new;
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'INVALID_TIMEZONE: % is not an IANA time zone name', new.timezone
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists business_settings_validate_timezone on public.business_settings;
create trigger business_settings_validate_timezone
  before insert or update on public.business_settings
  for each row execute function public.validate_business_timezone();

-- Storefront-public column list (see 20260101000001): add timezone. Re-granting an existing
-- column is a no-op, so this is safe to re-run.
grant select (timezone) on public.business_settings to anon;
