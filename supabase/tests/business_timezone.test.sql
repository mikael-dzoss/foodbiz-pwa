-- ============================================================================
-- Test Suite: business_timezone.test.sql (#168)
-- Description: business_settings.timezone: default Europe/Paris, only real IANA zone names
--              accepted (insert and update), manager-editable (no owner-only rule), readable by
--              anon (storefront), RLS tenant isolation unchanged.
-- Does not re-grant privileges (the migrations' privileges are under test).
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'manager_tz@example.com', '', now(), '{}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'owner_tz_b@example.com', '', now(), '{}', '{}', now(), now());

insert into public.businesses (id, name, slug, currency)
values
  ('10000000-0000-0000-0000-000000000001', 'Business A', 'tz-biz-a', 'EUR'),
  ('20000000-0000-0000-0000-000000000002', 'Business B', 'tz-biz-b', 'EUR');

insert into public.business_settings (business_id)
values ('10000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002');

insert into public.business_members (business_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'manager'),
  ('20000000-0000-0000-0000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'owner');

-- Table owner: default and validation
select is(
  (select timezone from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'),
  'Europe/Paris',
  'a settings row defaults to Europe/Paris');

select lives_ok(
  $$update public.business_settings set timezone = 'Africa/Douala' where business_id = '20000000-0000-0000-0000-000000000002'$$,
  'a link name such as Africa/Douala is accepted');

select throws_like(
  $$update public.business_settings set timezone = 'Mars/Olympus_Mons' where business_id = '20000000-0000-0000-0000-000000000002'$$,
  'INVALID_TIMEZONE%',
  'an unknown zone is rejected on update');

select throws_like(
  $$update public.business_settings set timezone = '' where business_id = '20000000-0000-0000-0000-000000000002'$$,
  'INVALID_TIMEZONE%',
  'an empty zone is rejected on update');

select throws_like(
  $$insert into public.business_settings (business_id, timezone) values (gen_random_uuid(), 'Not/AZone')$$,
  'INVALID_TIMEZONE%',
  'an unknown zone is rejected on insert');

select is(
  (select timezone from public.business_settings where business_id = '20000000-0000-0000-0000-000000000002'),
  'Africa/Douala',
  'rejected writes leave the stored zone untouched');

-- Manager (not owner): can change the zone
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a2000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select lives_ok(
  $$update public.business_settings set timezone = 'America/New_York' where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'a manager can change the time zone');

select throws_like(
  $$update public.business_settings set timezone = 'bogus' where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'INVALID_TIMEZONE%',
  'a manager cannot store an invalid zone');

select is(
  (select count(*)::int from public.business_settings where business_id = '20000000-0000-0000-0000-000000000002'),
  0,
  'a manager cannot read another business settings (RLS unchanged)');

-- anon: storefront reads the zone, not the private columns
reset role;
set local role anon;
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select is(
  (select timezone from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'),
  'America/New_York',
  'anon can read the time zone (storefront column grant)');

select throws_ok(
  $$select tax_percentage from public.business_settings$$,
  '42501', null,
  'anon still cannot read private settings columns');

update public.business_settings set timezone = 'UTC';

reset role;

select is(
  (select timezone from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'),
  'America/New_York',
  'anon cannot write the time zone (RLS filters every row)');

select * from finish();

rollback;
