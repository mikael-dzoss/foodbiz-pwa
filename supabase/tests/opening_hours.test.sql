-- ============================================================================
-- Test Suite: opening_hours.test.sql (#372, #375)
-- Description: pgTAP tests for business_settings.weekly_hours and
--              hours_exceptions, IMMUTABLE validators valid_weekly_hours and
--              valid_hours_exceptions, STABLE helpers is_open_at and
--              slot_error, anon storefront column grants, RLS isolation, and
--              function execute privileges.
-- Does not re-grant privileges (the migrations' privileges are under test).
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(128);

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
-- Section 2: valid_hours_exceptions(jsonb) (Tests 22-41)
-- ----------------------------------------------------------------------------
select is(public.valid_hours_exceptions('[]'::jsonb), true, 'valid_hours_exceptions accepts empty array');

select is(
  public.valid_hours_exceptions('[
    {"from": "2026-07-30", "to": "2026-08-03", "ranges": [], "note": "Congés annuels"},
    {"from": "2026-08-04", "to": "2026-08-04", "ranges": [{"open": "10:00", "close": "14:00"}, {"open": "18:00", "close": "24:00"}]}
  ]'::jsonb),
  true,
  'valid_hours_exceptions accepts adjacent holiday + special hours with 24:00 close and note'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-08-01", "to": "2026-09-29", "ranges": []}]'::jsonb),
  true,
  'valid_hours_exceptions accepts exact 60-day inclusive span (Aug 1 to Sep 29)'
);

select is(
  public.valid_hours_exceptions('[{"from": "2024-02-29", "to": "2024-02-29", "ranges": []}]'::jsonb),
  true,
  'valid_hours_exceptions accepts leap day 2024-02-29'
);

select is(
  public.valid_hours_exceptions(jsonb_build_array(jsonb_build_object('from', '2026-08-01', 'to', '2026-08-01', 'ranges', '[]'::jsonb, 'note', repeat('a', 50)))),
  true,
  'valid_hours_exceptions accepts note of exact length 50'
);

select is(
  public.valid_hours_exceptions('[
    {"from": "2026-08-10", "to": "2026-08-12", "ranges": []},
    {"from": "2026-08-01", "to": "2026-08-05", "ranges": []}
  ]'::jsonb),
  true,
  'valid_hours_exceptions accepts unsorted non-overlapping periods'
);

select is(public.valid_hours_exceptions(null), false, 'valid_hours_exceptions rejects null');
select is(public.valid_hours_exceptions('{}'::jsonb), false, 'valid_hours_exceptions rejects non-array JSON');

select is(
  public.valid_hours_exceptions(
    (select jsonb_agg(jsonb_build_object('from', to_char(date '2026-01-01' + g, 'YYYY-MM-DD'), 'to', to_char(date '2026-01-01' + g, 'YYYY-MM-DD'), 'ranges', '[]'::jsonb))
     from generate_series(0, 100) as g)
  ),
  false,
  'valid_hours_exceptions rejects 101 periods (> MAX_EXCEPTIONS)'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-08-10", "to": "2026-08-09", "ranges": []}]'::jsonb),
  false,
  'valid_hours_exceptions rejects to < from'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-08-01", "to": "2026-09-30", "ranges": []}]'::jsonb),
  false,
  'valid_hours_exceptions rejects 61-day inclusive span (> 60)'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-02-30", "to": "2026-02-30", "ranges": []}]'::jsonb),
  false,
  'valid_hours_exceptions rejects invalid calendar date 2026-02-30'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-02-29", "to": "2026-02-29", "ranges": []}]'::jsonb),
  false,
  'valid_hours_exceptions rejects non-leap day 2026-02-29'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-8-01", "to": "2026-08-02", "ranges": []}]'::jsonb),
  false,
  'valid_hours_exceptions rejects unpadded date string'
);

select is(
  public.valid_hours_exceptions(jsonb_build_array(jsonb_build_object('from', '2026-08-01', 'to', '2026-08-01', 'ranges', '[]'::jsonb, 'note', repeat('a', 51)))),
  false,
  'valid_hours_exceptions rejects note longer than 50 chars'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-08-01", "to": "2026-08-01", "ranges": [], "note": 123}]'::jsonb),
  false,
  'valid_hours_exceptions rejects non-string note'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-08-01", "to": "2026-08-01", "ranges": [], "extra": true}]'::jsonb),
  false,
  'valid_hours_exceptions rejects extra key on exception object'
);

select is(
  public.valid_hours_exceptions('[{"from": "2026-08-01", "to": "2026-08-01", "ranges": [{"open": "09:00", "close": "12:00"}, {"open": "12:00", "close": "15:00"}]}]'::jsonb),
  false,
  'valid_hours_exceptions rejects touching ranges inside an exception'
);

select is(
  public.valid_hours_exceptions('[
    {"from": "2026-08-01", "to": "2026-08-05", "ranges": []},
    {"from": "2026-08-05", "to": "2026-08-07", "ranges": []}
  ]'::jsonb),
  false,
  'valid_hours_exceptions rejects overlapping periods sharing a boundary date'
);

select is(
  public.valid_hours_exceptions('[
    {"from": "2026-08-03", "to": "2026-08-04", "ranges": []},
    {"from": "2026-08-01", "to": "2026-08-10", "ranges": []}
  ]'::jsonb),
  false,
  'valid_hours_exceptions rejects unsorted overlapping periods'
);

-- ----------------------------------------------------------------------------
-- Section 3: Column CHECK, RLS, and privilege checks (Tests 42-59)
-- ----------------------------------------------------------------------------
select is(
  (select weekly_hours from public.business_settings where business_id = '31000000-0000-0000-0000-000000000001'),
  null::jsonb,
  'business_settings.weekly_hours defaults to null'
);

select is(
  (select hours_exceptions from public.business_settings where business_id = '31000000-0000-0000-0000-000000000001'),
  '[]'::jsonb,
  'business_settings.hours_exceptions defaults to empty jsonb array'
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

select lives_ok(
  $$update public.business_settings
    set hours_exceptions = '[{"from": "2026-08-01", "to": "2026-08-05", "ranges": [], "note": "Congés annuels"}]'::jsonb
    where business_id = '31000000-0000-0000-0000-000000000001'$$,
  'a manager can update hours_exceptions to valid exceptions'
);

select throws_ok(
  $$update public.business_settings
    set hours_exceptions = '[{"from": "2026-08-05", "to": "2026-08-01", "ranges": []}]'::jsonb
    where business_id = '31000000-0000-0000-0000-000000000001'$$,
  '23514',
  null,
  'CHECK constraint rejects invalid hours_exceptions'
);

select is(
  (select count(*)::integer from public.business_settings where business_id = '32000000-0000-0000-0000-000000000002'),
  0,
  'a manager cannot read another business weekly_hours or hours_exceptions (RLS unchanged)'
);

-- Store valid values for anon read verification
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

select is(
  (select hours_exceptions -> 0 ->> 'note'
   from public.business_settings
   where business_id = '31000000-0000-0000-0000-000000000001'),
  'Congés annuels',
  'anon can read hours_exceptions (storefront column grant)'
);

-- RLS silently filters anon writes to 0 rows; verify after reset role.
update public.business_settings set weekly_hours = null, hours_exceptions = '[]'::jsonb;

reset role;

select is(
  (select weekly_hours -> 'mon' -> 0 ->> 'open'
   from public.business_settings
   where business_id = '31000000-0000-0000-0000-000000000001'),
  '09:00',
  'anon cannot modify weekly_hours (RLS filters every row)'
);

select is(
  (select hours_exceptions -> 0 ->> 'note'
   from public.business_settings
   where business_id = '31000000-0000-0000-0000-000000000001'),
  'Congés annuels',
  'anon cannot modify hours_exceptions (RLS filters every row)'
);

select is(
  (select count(*)::integer
   from pg_catalog.pg_proc p
   cross join lateral aclexplode(p.proacl) a
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('valid_weekly_hours', 'valid_hours_exceptions', 'is_open_at', 'slot_error')
     and a.grantee = 0),
  0,
  'PUBLIC has no execute privilege on opening-hours functions'
);

select ok(
  not has_function_privilege('anon', 'public.valid_weekly_hours(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.valid_hours_exceptions(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.is_open_at(jsonb, jsonb, text, timestamptz)', 'execute')
  and not has_function_privilege('anon', 'public.slot_error(jsonb, jsonb, text, timestamptz, date, time, boolean, integer, integer, integer)', 'execute'),
  'anon cannot execute any opening-hours function'
);

select ok(
  has_function_privilege('authenticated', 'public.valid_weekly_hours(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.valid_hours_exceptions(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.is_open_at(jsonb, jsonb, text, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.slot_error(jsonb, jsonb, text, timestamptz, date, time, boolean, integer, integer, integer)', 'execute'),
  'authenticated can execute only the validators (needed for CHECK evaluation)'
);

select ok(
  has_function_privilege('service_role', 'public.valid_weekly_hours(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.valid_hours_exceptions(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.is_open_at(jsonb, jsonb, text, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.slot_error(jsonb, jsonb, text, timestamptz, date, time, boolean, integer, integer, integer)', 'execute'),
  'service_role can execute all opening-hours functions'
);

select ok(
  (select provolatile from pg_catalog.pg_proc where oid = 'public.valid_weekly_hours(jsonb)'::regprocedure) = 'i'
  and (select provolatile from pg_catalog.pg_proc where oid = 'public.valid_hours_exceptions(jsonb)'::regprocedure) = 'i'
  and (select provolatile from pg_catalog.pg_proc where oid = 'public.is_open_at(jsonb, jsonb, text, timestamptz)'::regprocedure) = 's'
  and (select provolatile from pg_catalog.pg_proc where oid = 'public.slot_error(jsonb, jsonb, text, timestamptz, date, time, boolean, integer, integer, integer)'::regprocedure) = 's',
  'validators are IMMUTABLE and is_open_at / slot_error are STABLE'
);

-- Verify private column stays denied to anon
set local role anon;
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_ok(
  'select tax_percentage from public.business_settings',
  '42501',
  null,
  'anon still cannot read private business_settings columns'
);

reset role;

-- ----------------------------------------------------------------------------
-- Section 4: is_open_at(p_hours, p_exceptions, p_tz, p_at) (Tests 60-78)
-- ----------------------------------------------------------------------------
select is(
  public.is_open_at(null, '[]'::jsonb, 'Europe/Paris', '2026-07-12T03:00:00Z'::timestamptz),
  true,
  'is_open_at returns true when weekly_hours is null and no exception applies'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-06T07:00:00Z'::timestamptz
  ),
  true,
  'is_open_at is true at exact range open (09:00 CEST)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-06T08:30:00Z'::timestamptz
  ),
  true,
  'is_open_at is true inside range (10:30 CEST)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-06T10:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false at exact range close (12:00 CEST, half-open)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-06T11:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false in gap between ranges (13:00 CEST)'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-12T08:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false on a closed weekday (Sunday)'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[{"open":"18:00","close":"24:00"}],"sat":[{"open":"00:00","close":"01:00"}],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-10T21:59:59Z'::timestamptz
  ),
  true,
  'is_open_at is true at 23:59:59 local when close is 24:00'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[{"open":"18:00","close":"24:00"}],"sat":[{"open":"00:00","close":"01:00"}],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-10T22:00:00Z'::timestamptz
  ),
  true,
  'is_open_at is true at 00:00:00 Saturday continuation'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[{"open":"18:00","close":"24:00"}],"sat":[{"open":"00:00","close":"01:00"}],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-07-10T23:00:00Z'::timestamptz
  ),
  false,
  'is_open_at is false at 01:00:00 Saturday when continuation closes at 01:00'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"03:00","close":"04:00"}]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-03-29T00:59:00Z'::timestamptz
  ),
  false,
  'is_open_at handles DST spring-forward Sunday before jump (01:59 CET < 03:00)'
);

select is(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"03:00","close":"04:00"}]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-03-29T01:00:00Z'::timestamptz
  ),
  true,
  'is_open_at handles DST spring-forward Sunday at jump (01:00Z = 03:00 CEST)'
);

select ok(
  public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"02:00","close":"03:00"}]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-10-25T00:30:00Z'::timestamptz
  )
  and public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"02:00","close":"03:00"}]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-10-25T01:30:00Z'::timestamptz
  )
  and not public.is_open_at(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[{"open":"02:00","close":"03:00"}]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris',
    '2026-10-25T02:30:00Z'::timestamptz
  ),
  'is_open_at handles DST fall-back Sunday repeated 02:30 hour and 03:30 close in Europe/Paris'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"00:00","close":"24:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'America/New_York',
    '2026-07-06T02:00:00Z'::timestamptz
  ),
  false,
  'is_open_at evaluates weekday in business timezone (Sun 22:00 EDT is closed)'
);

-- Exception overrides in is_open_at (#375)
select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[{"open":"09:00","close":"18:00"}],"wed":[{"open":"09:00","close":"18:00"}],"thu":[{"open":"09:00","close":"18:00"}],"fri":[{"open":"09:00","close":"18:00"}],"sat":[],"sun":[]}'::jsonb,
    '[{"from":"2026-07-30","to":"2026-08-03","ranges":[],"note":"Congés annuels"}]'::jsonb,
    'Europe/Paris',
    '2026-07-31T08:00:00Z'::timestamptz
  ),
  false,
  'is_open_at: closed holiday exception overrides normally open Friday'
);

select is(
  public.is_open_at(
    '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[{"from":"2026-07-12","to":"2026-07-12","ranges":[{"open":"10:00","close":"14:00"}],"note":"Ouverture exceptionnelle"}]'::jsonb,
    'Europe/Paris',
    '2026-07-12T09:00:00Z'::timestamptz
  ),
  true,
  'is_open_at: special hours exception opens normally closed Sunday'
);

select is(
  public.is_open_at(
    null,
    '[{"from":"2026-07-30","to":"2026-08-03","ranges":[],"note":"Congés annuels"}]'::jsonb,
    'Europe/Paris',
    '2026-08-01T10:00:00Z'::timestamptz
  ),
  false,
  'is_open_at: closed exception applies even when weekly_hours is null'
);

select is(
  public.is_open_at(
    null,
    '[{"from":"2026-07-12","to":"2026-07-12","ranges":[{"open":"10:00","close":"14:00"}]}]'::jsonb,
    'Europe/Paris',
    '2026-07-12T09:00:00Z'::timestamptz
  ),
  true,
  'is_open_at: custom hours exception applies when weekly_hours is null (inside range -> true)'
);

select is(
  public.is_open_at(
    null,
    '[{"from":"2026-07-12","to":"2026-07-12","ranges":[{"open":"10:00","close":"14:00"}]}]'::jsonb,
    'Europe/Paris',
    '2026-07-12T13:00:00Z'::timestamptz
  ),
  false,
  'is_open_at: custom hours exception applies when weekly_hours is null (outside range -> false)'
);

select is(
  public.is_open_at(
    null,
    '[{"from":"2026-07-30","to":"2026-08-03","ranges":[]}]'::jsonb,
    'Europe/Paris',
    '2026-08-04T02:00:00Z'::timestamptz
  ),
  true,
  'is_open_at: uncovered date with weekly_hours null returns true'
);

-- ----------------------------------------------------------------------------
-- Section 5: slot_error(...) (Tests 79-112; section 6 adds 8 more)
-- ----------------------------------------------------------------------------
select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"wed":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"thu":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"fri":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"sat":[{"open":"10:00","close":"14:00"}],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '10:30', false
  ),
  null::text,
  'slot_error accepts valid future slot today'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[{"open":"09:00","close":"12:00"}],"thu":[{"open":"09:00","close":"12:00"}],"fri":[{"open":"09:00","close":"12:00"}],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-08-05', time '10:30', false
  ),
  null::text,
  'slot_error accepts today + 30 (inclusive default horizon)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-05', time '10:30', false
  ),
  'date_out_of_window',
  'slot_error rejects yesterday with date_out_of_window'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[{"open":"09:00","close":"12:00"}],"thu":[{"open":"09:00","close":"12:00"}],"fri":[{"open":"09:00","close":"12:00"}],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-08-06', time '10:30', false
  ),
  'date_out_of_window',
  'slot_error rejects today + 31 with date_out_of_window'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-13', time '10:00', false, 7
  ),
  null::text,
  'slot_error accepts today + custom horizon (7 days)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-14', time '10:00', false, 7
  ),
  'date_out_of_window',
  'slot_error rejects today + custom horizon + 1 with date_out_of_window'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-05', null, true
  ),
  'date_out_of_window',
  'slot_error enforces booking window before ASAP check'
);

select is(
  public.slot_error(
    null, '[]'::jsonb, 'Europe/Paris', '2026-07-06T16:00:00Z'::timestamptz, date '2026-07-12', time '03:00', false
  ),
  null::text,
  'slot_error skips opening-hour checks when weekly_hours is null and no exception applies'
);

select is(
  public.slot_error(
    null, '[]'::jsonb, 'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-06', null, true
  ),
  null::text,
  'slot_error skips closed_now when weekly_hours is null and no exception applies'
);

select is(
  public.slot_error(
    null, '[]'::jsonb, 'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-05', null, false
  ),
  'date_out_of_window',
  'slot_error still enforces lower window bound when weekly_hours is null'
);

select is(
  public.slot_error(
    null, '[]'::jsonb, 'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-08-06', null, false
  ),
  'date_out_of_window',
  'slot_error still enforces upper window bound when weekly_hours is null'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', null, true
  ),
  null::text,
  'slot_error accepts ASAP when store is currently open'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-06', null, true
  ),
  'closed_now',
  'slot_error rejects ASAP when store is currently closed (lunch gap)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-12', time '10:00', false
  ),
  'closed_day',
  'slot_error rejects scheduled order with time on a closed weekday'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-12', null, false
  ),
  'closed_day',
  'slot_error rejects time-optional scheduled order on a closed weekday'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-07', time '13:00', false
  ),
  'time_outside_hours',
  'slot_error rejects time in gap between ranges with time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[],"tue":[{"open":"09:00","close":"18:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-07', time '18:00', false
  ),
  'time_outside_hours',
  'slot_error rejects time at exact close with time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[],"tue":[{"open":"00:00","close":"24:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-07', time '24:00', false
  ),
  'time_outside_hours',
  'slot_error rejects 24:00 as a slot start time with time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '08:00', false
  ),
  'time_outside_hours',
  'slot_error returns time_outside_hours before time_in_past when time is both outside range and in past'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '10:00', false
  ),
  'time_in_past',
  'slot_error rejects today slot at exact current minute (lead = 0 requires strictly after now)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '10:01', false
  ),
  null::text,
  'slot_error accepts today slot one minute after now'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T15:44:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  null::text,
  'slot_error accepts time-optional today when last 15-min slot (17:45) is still strictly ahead (at 17:44)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"14:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T15:45:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'time_in_past',
  'slot_error rejects time-optional today when at last 15-min slot (17:45) and no later slot exists'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"11:05","close":"11:25"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T09:19:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  null::text,
  'slot_error steps from range open (11:05-11:25 has 11:20 slot still ahead at 11:19)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"11:05","close":"11:25"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T09:20:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'time_in_past',
  'slot_error steps from range open (11:05-11:25 has no slot strictly after 11:20)'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T16:00:00Z'::timestamptz, date '2026-07-07', null, false
  ),
  null::text,
  'slot_error accepts time-optional scheduled order on an open future day'
);

-- Exception overrides in slot_error (#375)
select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[{"open":"09:00","close":"18:00"}],"wed":[{"open":"09:00","close":"18:00"}],"thu":[{"open":"09:00","close":"18:00"}],"fri":[{"open":"09:00","close":"18:00"}],"sat":[],"sun":[]}'::jsonb,
    '[{"from":"2026-07-30","to":"2026-08-03","ranges":[],"note":"Congés annuels"}]'::jsonb,
    'Europe/Paris', '2026-07-31T08:00:00Z'::timestamptz, date '2026-07-31', null, true
  ),
  'closed_now',
  'slot_error: holiday exception rejects ASAP on normally open Friday -> closed_now'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[{"open":"09:00","close":"18:00"}],"wed":[{"open":"09:00","close":"18:00"}],"thu":[{"open":"09:00","close":"18:00"}],"fri":[{"open":"09:00","close":"18:00"}],"sat":[{"open":"10:00","close":"14:00"}],"sun":[]}'::jsonb,
    '[{"from":"2026-07-30","to":"2026-08-03","ranges":[],"note":"Congés annuels"}]'::jsonb,
    'Europe/Paris', '2026-07-28T08:00:00Z'::timestamptz, date '2026-08-01', time '11:00', false
  ),
  'closed_day',
  'slot_error: holiday exception across month boundary rejects scheduled order -> closed_day'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[{"from":"2026-07-12","to":"2026-07-12","ranges":[{"open":"10:00","close":"14:00"}],"note":"Ouverture exceptionnelle"}]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-12', time '11:30', false
  ),
  null::text,
  'slot_error: special hours exception on normally closed Sunday accepts in-range slot'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"18:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[{"from":"2026-07-12","to":"2026-07-12","ranges":[{"open":"10:00","close":"14:00"}]}]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-12', time '15:00', false
  ),
  'time_outside_hours',
  'slot_error: special hours exception rejects out-of-range slot -> time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[{"from":"2026-07-12","to":"2026-07-12","ranges":[{"open":"10:00","close":"14:00"}]}]'::jsonb,
    'Europe/Paris', '2026-07-12T09:00:00Z'::timestamptz, date '2026-07-12', null, true
  ),
  null::text,
  'slot_error: special hours exception accepts ASAP on normally closed Sunday'
);

select is(
  public.slot_error(
    null,
    '[{"from":"2026-07-30","to":"2026-08-03","ranges":[],"note":"Congés annuels"}]'::jsonb,
    'Europe/Paris', '2026-08-01T10:00:00Z'::timestamptz, date '2026-08-01', null, true
  ),
  'closed_now',
  'slot_error: holiday exception rejects ASAP even when weekly_hours is null'
);

select is(
  public.slot_error(
    null,
    '[{"from":"2026-07-30","to":"2026-08-03","ranges":[],"note":"Congés annuels"}]'::jsonb,
    'Europe/Paris', '2026-07-28T08:00:00Z'::timestamptz, date '2026-08-01', time '11:00', false
  ),
  'closed_day',
  'slot_error: holiday exception rejects scheduled order even when weekly_hours is null'
);

select is(
  public.slot_error(
    null,
    '[{"from":"2026-07-12","to":"2026-07-12","ranges":[{"open":"10:00","close":"14:00"}]}]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-12', time '16:00', false
  ),
  'time_outside_hours',
  'slot_error: custom hours exception enforces time_outside_hours even when weekly_hours is null'
);

-- ----------------------------------------------------------------------------
-- Section 6: review-round-2 hardening (NULL args, seconds, lead, step)
-- ----------------------------------------------------------------------------
select throws_ok(
  $$select public.is_open_at(null, '[]'::jsonb, 'Europe/Paris', null)$$,
  '22023', null, 'is_open_at rejects NULL p_at'
);

select throws_ok(
  $$select public.is_open_at(null, '[]'::jsonb, null, now())$$,
  '22023', null, 'is_open_at rejects NULL p_tz'
);

select throws_ok(
  $$select public.slot_error(null, '[]'::jsonb, 'Europe/Paris', null, date '2026-07-06', null, false)$$,
  '22023', null, 'slot_error rejects NULL p_now'
);

select throws_ok(
  $$select public.slot_error(null, '[]'::jsonb, null, now(), date '2026-07-06', null, false)$$,
  '22023', null, 'slot_error rejects NULL p_tz'
);

select throws_ok(
  $$select public.slot_error(null, '[]'::jsonb, 'Europe/Paris', now(), date '2026-07-06', null, false, 30, 0, 0)$$,
  '22023', null, 'slot_error rejects p_step_minutes = 0'
);

select throws_ok(
  $$select public.slot_error(null, '[]'::jsonb, 'Europe/Paris', now(), date '2026-07-06', null, false, 30, 15, -1)$$,
  '22023', null, 'slot_error rejects negative p_lead_minutes'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T06:00:00Z'::timestamptz, date '2026-07-06', time '10:30:30', false
  ),
  'time_outside_hours',
  'slot_error: p_time with non-zero seconds is time_outside_hours'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"}],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', time '10:20', false, 30, 15, 30
  ),
  'time_in_past',
  'slot_error: p_lead_minutes = 30 rejects a slot 20 minutes ahead'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T05:00:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'closed_now',
  'slot_error: time-less order today before opening is closed_now'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'closed_now',
  'slot_error: time-less order today in lunch gap is closed_now'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T08:00:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  null::text,
  'slot_error: time-less order today while open now is accepted'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-07', null, false
  ),
  null::text,
  'slot_error: time-less order on future open day unaffected while closed now'
);

select is(
  public.slot_error(
    '{"mon":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}],"tue":[{"open":"09:00","close":"12:00"}],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]}'::jsonb,
    '[]'::jsonb,
    'Europe/Paris', '2026-07-06T16:00:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'time_in_past',
  'slot_error: time-less order today with no slots left stays time_in_past'
);

select is(
  public.slot_error(
    null, '[]'::jsonb, 'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  null::text,
  'slot_error: time-less order today with null hours and no exception is skipped'
);

select is(
  public.slot_error(
    null,
    '[{"from":"2026-07-06","to":"2026-07-06","ranges":[{"open":"09:00","close":"12:00"},{"open":"14:00","close":"18:00"}]}]'::jsonb,
    'Europe/Paris', '2026-07-06T10:30:00Z'::timestamptz, date '2026-07-06', null, false
  ),
  'closed_now',
  'slot_error: time-less order today honours exception ranges (closed now)'
);

select * from finish();

rollback;
