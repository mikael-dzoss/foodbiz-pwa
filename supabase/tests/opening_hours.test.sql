-- ============================================================================
-- Test Suite: opening_hours.test.sql (#372)
-- Description: pgTAP tests for business_settings.weekly_hours, the IMMUTABLE
--              validator valid_weekly_hours, STABLE helpers is_open_at and
--              slot_error, anon storefront column grant, RLS isolation, and
--              function execute privileges.
-- Does not re-grant privileges (the migrations' privileges are under test).
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(72);

-- ----------------------------------------------------------------------------
-- Seeds (run as migration/table owner)
-- ----------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a3000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'manager_oh@example.com', '', now(), '{}', '{}', now(), now()),
  ('b3000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'owner_oh_b@example.com', '', now(), '{}', '{}', now(), now());

insert into public.businesses (id, name, slug, currency)
values
  ('31000000-0000-0000-0000-000000000001', 'Hours Biz A', 'oh-biz-a', 'EUR'),
  ('32000000-0000-0000-0000-000000000002', 'Hours Biz B', 'oh-biz-b', 'EUR');

insert into public.business_settings (business_id)
values
  ('31000000-0000-0000-0000-000000000001'),
  ('32000000-0000-0000-0000-000000000002');

insert into public.business_members (business_id, user_id, role)
values
  ('31000000-0000-0000-0000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'manager'),
  ('32000000-0000-0000-0000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'owner');

-- ----------------------------------------------------------------------------
-- Section 1: valid_weekly_hours(jsonb) (Tests 1-21)
-- ----------------------------------------------------------------------------
select is(
  public.valid_weekly_hours('{
    "mon": [{"open": "09:00", "close": "12:00"}, {"open": "14:00", "close": "18:00"}],
    "tue": [{"open": "09:00", "close": "12:00"}, {"open": "14:00", "close": "18:00"}],
    "wed": [{"open": "09:00", "close": "12:00"}, {"open": "14:00", "close": "18:00"}],
    "thu": [{"open": "09:00", "close": "12:00"}, {"open": "14:00", "close": "18:00"}],
    "fri": [{"open": "09:00", "close": "12:00"}, {"open": "14:00", "close": "18:00"}],
    "sat": [{"open": "10:00", "close": "14:00"}],
    "sun": []
  }'::jsonb),
  true,
  'valid_weekly_hours accepts a standard multi-range week'
);

select is(
  public.valid_weekly_hours('{
    "mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
  }'::jsonb),
  true,
  'valid_weekly_hours accepts an all-closed week'
);

select is(
  public.valid_weekly_hours('{
    "mon": [{"open": "00:00", "close": "24:00"}],
    "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
  }'::jsonb),
  true,
  'valid_weekly_hours accepts a 00:00-24:00 full-day range'
);

select is(
  public.valid_weekly_hours('{
    "mon": [
      {"open": "06:00", "close": "08:00"},
      {"open": "09:00", "close": "11:00"},
      {"open": "12:00", "close": "14:00"},
      {"open": "18:00", "close": "22:00"}
    ],
    "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
  }'::jsonb),
  true,
  'valid_weekly_hours accepts 4 disjoint ranges in a day (MAX_RANGES_PER_DAY)'
);

select is(
  public.valid_weekly_hours('{
    "mon": [],
    "tue": [{"open": "11:30", "close": "14:30"}, {"open": "18:00", "close": "22:00"}],
    "wed": [{"open": "11:30", "close": "14:30"}, {"open": "18:00", "close": "22:00"}],
    "thu": [{"open": "11:30", "close": "14:30"}, {"open": "18:00", "close": "22:00"}],
    "fri": [{"open": "11:30", "close": "14:30"}, {"open": "18:00", "close": "24:00"}],
    "sat": [{"open": "00:00", "close": "01:00"}, {"open": "11:30", "close": "15:00"}, {"open": "18:00", "close": "24:00"}],
    "sun": [{"open": "00:00", "close": "01:00"}, {"open": "12:00", "close": "16:00"}]
  }'::jsonb),
  true,
  'valid_weekly_hours accepts overnight splits across midnight (Les Saveurs du Continent schedule)'
);

select is(public.valid_weekly_hours(null), false, 'valid_weekly_hours rejects null');
select is(public.valid_weekly_hours('[]'::jsonb), false, 'valid_weekly_hours rejects non-object JSON');

select is(
  public.valid_weekly_hours('{"mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": []}'::jsonb),
  false,
  'valid_weekly_hours rejects missing weekday key'
);

select is(
  public.valid_weekly_hours('{"mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": [], "extra": []}'::jsonb),
  false,
  'valid_weekly_hours rejects extra weekday key'
);

select is(
  public.valid_weekly_hours('{"mon": null, "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects non-array day value'
);

select is(
  public.valid_weekly_hours('{
    "mon": [
      {"open": "06:00", "close": "07:00"},
      {"open": "08:00", "close": "09:00"},
      {"open": "10:00", "close": "11:00"},
      {"open": "12:00", "close": "13:00"},
      {"open": "14:00", "close": "15:00"}
    ],
    "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []
  }'::jsonb),
  false,
  'valid_weekly_hours rejects 5 ranges on a single day'
);

select is(
  public.valid_weekly_hours('{"mon": ["09:00-12:00"], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects non-object range element'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "09:00", "close": "12:00", "note": "lunch"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects extra keys on a range object'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": 900, "close": "12:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects non-string open/close values'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "24:00", "close": "24:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects open time 24:00'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "18:00", "close": "24:30"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects close time 24:30'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "9:00", "close": "12:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects non-zero-padded time'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "12:00", "close": "12:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects zero-length range (close = open)'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "09:00", "close": "13:00"}, {"open": "12:00", "close": "15:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects overlapping ranges'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "09:00", "close": "12:00"}, {"open": "12:00", "close": "15:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects touching ranges (prev.close = next.open)'
);

select is(
  public.valid_weekly_hours('{"mon": [{"open": "14:00", "close": "18:00"}, {"open": "09:00", "close": "12:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb),
  false,
  'valid_weekly_hours rejects unsorted ranges'
);

-- ----------------------------------------------------------------------------
-- Section 2: Column CHECK, RLS, and privilege checks (Tests 22-33)
-- ----------------------------------------------------------------------------
select is(
  (select weekly_hours from public.business_settings where business_id = '31000000-0000-0000-0000-000000000001'),
  null::jsonb,
  'business_settings.weekly_hours defaults to null'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a3000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$update public.business_settings
    set weekly_hours = '{"mon": [], "tue": [{"open": "11:30", "close": "14:30"}], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb
    where business_id = '31000000-0000-0000-0000-000000000001'$$,
  'a manager can update weekly_hours to a valid schedule'
);

select throws_ok(
  $$update public.business_settings
    set weekly_hours = '{"mon": []}'::jsonb
    where business_id = '31000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'CHECK constraint rejects invalid weekly_hours'
);

select lives_ok(
  $$update public.business_settings
    set weekly_hours = null
    where business_id = '31000000-0000-0000-0000-000000000001'$$,
  'a manager can clear weekly_hours back to null'
);

select is(
  (select count(*)::integer from public.business_settings where business_id = '32000000-0000-0000-0000-000000000002'),
  0,
  'a manager cannot read another business weekly_hours (RLS unchanged)'
);

-- Store a valid value for anon read verification
select lives_ok(
  $$update public.business_settings
    set weekly_hours = '{"mon": [{"open": "09:00", "close": "17:00"}], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb
    where business_id = '31000000-0000-0000-0000-000000000001'$$,
  'manager re-sets weekly_hours for anon read test'
);

reset role;
set local role anon;
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select is(
  (select weekly_hours -> 'mon' -> 0 ->> 'open'
   from public.business_settings
   where business_id = '31000000-0000-0000-0000-000000000001'),
  '09:00',
  'anon can read weekly_hours (storefront column grant)'
);

-- RLS silently filters anon writes to 0 rows; verify after reset role.
update public.business_settings set weekly_hours = null;

reset role;

select is(
  (select weekly_hours -> 'mon' -> 0 ->> 'open'
   from public.business_settings
   where business_id = '31000000-0000-0000-0000-000000000001'),
  '09:00',
  'anon cannot modify weekly_hours (RLS filters every row)'
);

select is(
  (select count(*)::integer
   from pg_catalog.pg_proc p
   cross join lateral aclexplode(p.proacl) a
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('valid_weekly_hours', 'is_open_at', 'slot_error')
     and a.grantee = 0),
  0,
  'PUBLIC has no execute privilege on valid_weekly_hours, is_open_at, or slot_error'
);

select ok(
  has_function_privilege('anon', 'public.valid_weekly_hours(jsonb)', 'execute')
  and has_function_privilege('anon', 'public.is_open_at(jsonb, text, timestamptz)', 'execute')
  and has_function_privilege('anon', 'public.slot_error(jsonb, text, timestamptz, date, time, boolean, integer)', 'execute'),
  'anon can execute valid_weekly_hours, is_open_at, and slot_error'
);

select ok(
  has_function_privilege('authenticated', 'public.valid_weekly_hours(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.is_open_at(jsonb, text, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.slot_error(jsonb, text, timestamptz, date, time, boolean, integer)', 'execute')
  and has_function_privilege('service_role', 'public.valid_weekly_hours(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.is_open_at(jsonb, text, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.slot_error(jsonb, text, timestamptz, date, time, boolean, integer)', 'execute'),
  'authenticated and service_role can execute valid_weekly_hours, is_open_at, and slot_error'
);

select ok(
  (select provolatile from pg_catalog.pg_proc where oid = 'public.valid_weekly_hours(jsonb)'::regprocedure) = 'i'
  and (select provolatile from pg_catalog.pg_proc where oid = 'public.is_open_at(jsonb, text, timestamptz)'::regprocedure) = 's'
  and (select provolatile from pg_catalog.pg_proc where oid = 'public.slot_error(jsonb, text, timestamptz, date, time, boolean, integer)'::regprocedure) = 's',
  'valid_weekly_hours is IMMUTABLE and is_open_at / slot_error are STABLE'
);

-- ----------------------------------------------------------------------------
-- Section 3: is_open_at(p_hours, p_tz, p_at) (Tests 34-46)
-- ----------------------------------------------------------------------------
select is(
  public.is_open_at(null, 'Europe/Paris', '2026-07-12T03:00:00Z'::timestamptz),
  true,
  'is_open_at returns true when weekly_hours is null'
);

-- Mon 2026-07-06 in Europe/Paris (CEST = UTC+2): ranges 09:00-12:00, 14:00-18:00; Sun closed
select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-06T07:00:00Z'::timestamptz
  ),
  true,
  'is_open_at is true at exact range open (09:00 CEST)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-06T08:30:00Z'::timestamptz
  ),
  true,
  'is_open_at is true inside range (10:30 CEST)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-06T10:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false at exact range close (12:00 CEST, half-open)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-06T11:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false in gap between ranges (13:00 CEST)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-12T08:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false on a closed weekday (Sunday)'
);

-- 24:00 close and midnight rollover: Fri 2026-07-10 18:00-24:00, Sat 2026-07-11 00:00-01:00 (CEST = UTC+2)
select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[{"open":"18:00","close":"24:00"}],"sat":[{"open":"00:00","close":"01:00"}],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-10T21:59:59Z'::timestamptz
  ),
  true,
  'is_open_at is true at 23:59:59 local when close is 24:00'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[{"open":"18:00","close":"24:00"}],"sat":[{"open":"00:00","close":"01:00"}],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-10T22:00:00Z'::timestamptz
  ),
  true,
  'is_open_at is true at 00:00:00 Saturday continuation'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[{"open":"18:00","close":"24:00"}],"sat":[{"open":"00:00","close":"01:00"}],"sun":[]}'::jsonb,
    'Europe/Paris',
    '2026-07-10T23:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false at 01:00:00 Saturday when continuation closes at 01:00'
);

-- DST spring-forward Sunday in Europe/Paris: 2026-03-29 (01:59 CET -> 03:00 CEST at 01:00Z)
select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"03:00","close":"04:00"}]}'::jsonb,
    'Europe/Paris',
    '2026-03-29T00:59:00Z'::timestamptz
  ),
  false,
  'is_open_at handles DST spring-forward Sunday before jump (01:59 CET < 03:00)'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"03:00","close":"04:00"}]}'::jsonb,
    'Europe/Paris',
    '2026-03-29T01:00:00Z'::timestamptz
  ),
  true,
  'is_open_at handles DST spring-forward Sunday at jump (01:00Z = 03:00 CEST)'
);

-- DST fall-back Sunday in Europe/Paris: 2026-10-25 (00:30Z = 02:30 CEST, 01:30Z = 02:30 CET, 02:30Z = 03:30 CET)
select ok(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"02:00","close":"03:00"}]}'::jsonb,
    'Europe/Paris',
    '2026-10-25T00:30:00Z'::timestamptz
  )
  and public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"02:00","close":"03:00"}]}'::jsonb,
    'Europe/Paris',
    '2026-10-25T01:30:00Z'::timestamptz
  )
  and not public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"02:00","close":"03:00"}]}'::jsonb,
    'Europe/Paris',
    '2026-10-25T02:30:00Z'::timestamptz
  ),
  'is_open_at handles DST fall-back Sunday repeated 02:30 hour and 03:30 close in Europe/Paris'
);

-- Cross-timezone day boundary: 2026-07-06T02:00:00Z = Mon 04:00 Paris, Sun 22:00 New York
select is(
  public.is_open_at(
    '{"mon":[{"open":"00:00","close":"24:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'America/New_York',
    '2026-07-06T02:00:00Z'::timestamptz
  ),
  false,
  'is_open_at evaluates weekday in business timezone (Sun 22:00 EDT is closed)'
);

-- ----------------------------------------------------------------------------
-- Section 4: slot_error(...) (Tests 47-72)
-- Reference week: Mon-Fri 09:00-12:00 & 14:00-18:00, Sat 10:00-14:00, Sun closed
-- Reference now:  2026-07-06T08:00:00Z = Mon 2026-07-06 10:00 CEST (Paris)
--                 today+30 = 2026-08-05 (Wed); today+31 = 2026-08-06
-- ----------------------------------------------------------------------------
select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"wed":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"thu":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"fri":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"sat":[{"open":"10:00","close":"14:00"}],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '10:30', false
  ),
  null::text,
  'slot_error accepts valid future slot today'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[{"open":"09:00","close":"12:00"}],"thu":[{"open":"09:00","close":"12:00"}],"fri":[{"open":"09:00","close":"12:00"}],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-08-05', time '10:30', false
  ),
  null::text,
  'slot_error accepts today + 30 (inclusive default horizon)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-05', time '10:30', false
  ),
  'date_out_of_window',
  'slot_error rejects yesterday with date_out_of_window'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[{"open":"09:00","close":"12:00"}],"thu":[{"open":"09:00","close":"12:00"}],"fri":[{"open":"09:00","close":"12:00"}],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-08-06', time '10:30', false
  ),
  'date_out_of_window',
  'slot_error rejects today + 31 with date_out_of_window'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-13', time '10:00', false, 7
  ),
  null::text,
  'slot_error accepts today + custom horizon (7 days)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-14', time '10:00', false, 7
  ),
  'date_out_of_window',
  'slot_error rejects today + custom horizon + 1 with date_out_of_window'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-05', null, true
  ),
  'date_out_of_window',
  'slot_error enforces booking window before ASAP check'
);

-- Null hours skip
select is(
  public.slot_error(
    null, 'Europe/Paris', '2026-07-06T16:00:00Z'::timestamptz, date '2026-07-12', time '03:00', false
  ),
  null::text,
  'slot_error skips opening-hour checks when weekly_hours is null (scheduled)'
);

select is(
  public.slot_error(
    null, 'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-06', null, true
  ),
  null::text,
  'slot_error skips closed_now when weekly_hours is null (ASAP)'
);

select is(
  public.slot_error(
    null, 'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-05', null, false
  ),
  'date_out_of_window',
  'slot_error still enforces lower window bound when weekly_hours is null'
);

select is(
  public.slot_error(
    null, 'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-08-06', null, false
  ),
  'date_out_of_window',
  'slot_error still enforces upper window bound when weekly_hours is null'
);

-- ASAP
select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', null, true
  ),
  null::text,
  'slot_error accepts ASAP when store is currently open'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-06', null, true
  ),
  'closed_now',
  'slot_error rejects ASAP when store is currently closed (lunch gap)'
);

-- Closed day
select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-12', time '10:00', false
  ),
  'closed_day',
  'slot_error rejects scheduled order with time on a closed weekday'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-12', null, false
  ),
  'closed_day',
  'slot_error rejects time-optional scheduled order on a closed weekday'
);

-- Time outside hours
select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-07', time '13:00', false
  ),
  'time_outside_hours',
  'slot_error rejects time in gap between ranges with time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[],"tue":[{"open":"09:00","close":"18:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-07', time '18:00', false
  ),
  'time_outside_hours',
  'slot_error rejects time at exact close with time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[],"tue":[{"open":"00:00","close":"24:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-07', time '24:00', false
  ),
  'time_outside_hours',
  'slot_error rejects 24:00 as a slot start time with time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '08:00', false
  ),
  'time_outside_hours',
  'slot_error returns time_outside_hours before time_in_past when time is both outside range and in past'
);

-- Time in past (explicit time on today, lead = 0)
select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '10:00', false
  ),
  'time_in_past',
  'slot_error rejects today slot at exact current minute (lead = 0 requires strictly after now)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '10:01', false
  ),
  null::text,
  'slot_error accepts today slot one minute after now'
);

-- Time-optional (p_time is null; step = 15, lead = 0)
-- Range 14:00-18:00 -> stepped slots 14:00..17:45. At 17:44 CEST (15:44Z) slot 17:45 remains; at 17:45 CEST (15:45Z) none remain.
select is(
  public.slot_error(
    '{"mon":[{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T15:44:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  null::text,
  'slot_error accepts time-optional today when last 15-min slot (17:45) is still strictly ahead (at 17:44)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T15:45:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'time_in_past',
  'slot_error rejects time-optional today when at last 15-min slot (17:45) and no later slot exists'
);

-- Non-aligned open minute: 11:05-11:25 -> stepped slots 11:05 and 11:20.
select is(
  public.slot_error(
    '{"mon":[{"open":"11:05","close":"11:25"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T09:19:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  null::text,
  'slot_error steps from range open (11:05-11:25 has 11:20 slot still ahead at 11:19)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"11:05","close":"11:25"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T09:20:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'time_in_past',
  'slot_error steps from range open (11:05-11:25 has no slot strictly after 11:20)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    'Europe/Paris', '2026-07-06T16:00:00Z'::timestamptz, date '2026-07-07', null, false
  ),
  null::text,
  'slot_error accepts time-optional scheduled order on an open future day'
);

select * from finish();

rollback;
