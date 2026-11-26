-- ============================================================================
-- Test Suite: pickup_locations.test.sql (#385)
-- Description: pgTAP tests for relay pickup locations: RLS (anon sees only
--              active rows, members manage their own business only), column
--              checks, the 20-per-business limit, cascade on business delete
--              and the business_settings.shop_pickup_enabled storefront column.
--
-- Like public_surface.test.sql, this file does NOT blanket-grant table
-- privileges: the explicit grants of migration 20260101000035 are under test.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(35);

-- ----------------------------------------------------------------------------
-- Seeds (as the migration role)
-- ----------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1111111-1111-1111-1111-111111111111'::uuid, 'authenticated', 'authenticated', 'pl_member_a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'authenticated', 'authenticated', 'pl_outsider@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.businesses (id, name, slug, currency)
values
  ('a1000000-0000-0000-0000-0000000000a1'::uuid, 'PL Business A', 'pl-biz-a', 'EUR'),
  ('a2000000-0000-0000-0000-0000000000b2'::uuid, 'PL Business B', 'pl-biz-b', 'EUR'),
  ('a3000000-0000-0000-0000-0000000000c3'::uuid, 'PL Business C', 'pl-biz-c', 'EUR');

insert into public.business_members (business_id, user_id, role)
values
  ('a1000000-0000-0000-0000-0000000000a1'::uuid, 'c1111111-1111-1111-1111-111111111111'::uuid, 'manager');

insert into public.business_settings (business_id)
values
  ('a1000000-0000-0000-0000-0000000000a1'::uuid),
  ('a2000000-0000-0000-0000-0000000000b2'::uuid);

insert into public.pickup_locations (id, business_id, name, address, postcode, fee_cents, is_active, sort_order)
values
  ('e1000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-0000000000a1'::uuid, 'A active', '1 Rue A', '93210', 0, true, 0),
  ('e1000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-0000000000a1'::uuid, 'A inactive', '2 Rue A', '93210', 150, false, 1),
  ('e2000000-0000-0000-0000-000000000001'::uuid, 'a2000000-0000-0000-0000-0000000000b2'::uuid, 'B active', '1 Rue B', '93200', 0, true, 0),
  ('e2000000-0000-0000-0000-000000000002'::uuid, 'a2000000-0000-0000-0000-0000000000b2'::uuid, 'B inactive', '2 Rue B', '93200', 0, false, 1),
  ('e3000000-0000-0000-0000-000000000001'::uuid, 'a3000000-0000-0000-0000-0000000000c3'::uuid, 'C active', '1 Rue C', '75001', 0, true, 0);

-- ----------------------------------------------------------------------------
-- Structure
-- ----------------------------------------------------------------------------
select ok(relrowsecurity, 'pickup_locations has RLS enabled') from pg_class where oid = 'public.pickup_locations'::regclass;

select has_trigger('public', 'pickup_locations', 'trigger_pickup_locations_updated_at', 'updated_at trigger exists');

select col_default_is('public', 'pickup_locations', 'fee_cents', '0', 'fee_cents defaults to 0 (free)');
select col_default_is('public', 'pickup_locations', 'is_active', 'true', 'is_active defaults to true');

-- ----------------------------------------------------------------------------
-- anon: active rows of any business only, read-only
-- ----------------------------------------------------------------------------
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

select is(
  (select count(*)::int from public.pickup_locations),
  3,
  'anon sees only the 3 active locations across businesses'
);

select is(
  (select count(*)::int from public.pickup_locations where is_active = false),
  0,
  'anon cannot see inactive locations'
);

select is(
  (select count(*)::int from public.pickup_locations where business_id = 'a2000000-0000-0000-0000-0000000000b2'::uuid),
  1,
  'anon sees the active location of another business (storefront)'
);

select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode) values ('a1000000-0000-0000-0000-0000000000a1', 'Anon', 'x', '93210')$$,
  '42501', null, 'anon cannot insert locations'
);
select throws_ok(
  $$update public.pickup_locations set name = 'Hacked'$$,
  '42501', null, 'anon cannot update locations'
);
select throws_ok(
  $$delete from public.pickup_locations$$,
  '42501', null, 'anon cannot delete locations'
);

select is(
  (select shop_pickup_enabled from public.business_settings where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid),
  true,
  'anon can read business_settings.shop_pickup_enabled (default true)'
);

-- ----------------------------------------------------------------------------
-- Outsider (authenticated, not a member): same as anon on reads, no writes
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'c2222222-2222-2222-2222-222222222222';
set local "request.jwt.claims" = '{"sub": "c2222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select count(*)::int from public.pickup_locations where is_active = false),
  0,
  'a non-member authenticated user cannot see inactive locations'
);

select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode) values ('a1000000-0000-0000-0000-0000000000a1', 'Outsider', 'x', '93210')$$,
  '42501', null, 'a non-member cannot insert into a business'
);

select is(
  (with u as (update public.pickup_locations set name = 'Hacked' where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid returning 1) select count(*)::int from u),
  0,
  'a non-member cannot update a business''s locations'
);

select is(
  (with d as (delete from public.pickup_locations where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid returning 1) select count(*)::int from d),
  0,
  'a non-member cannot delete a business''s locations'
);

-- ----------------------------------------------------------------------------
-- Member of business A
-- ----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'c1111111-1111-1111-1111-111111111111';
set local "request.jwt.claims" = '{"sub": "c1111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.pickup_locations where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid),
  2,
  'member A sees all (active and inactive) locations of business A'
);

select is(
  (select count(*)::int from public.pickup_locations where business_id = 'a2000000-0000-0000-0000-0000000000b2'::uuid and is_active = false),
  0,
  'member A cannot see inactive locations of business B'
);

select is(
  (select count(*)::int from public.pickup_locations where business_id = 'a2000000-0000-0000-0000-0000000000b2'::uuid),
  1,
  'member A sees the active location of business B like any visitor'
);

select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode) values ('a1000000-0000-0000-0000-0000000000a1', '  ', 'x', '93210')$$,
  '23514', null, 'a blank name is rejected'
);

select lives_ok(
  $$insert into public.pickup_locations (business_id, name, description, address, postcode, fee_cents, weekly_hours, sort_order)
    values (
      'a1000000-0000-0000-0000-0000000000a1', 'A new', 'Near the kiosk', '3 Rue A', '93210', 10000,
      '{"mon": [], "tue": [{"open": "18:00", "close": "20:00"}], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}'::jsonb,
      2
    )$$,
  'member A can insert a location with fee 10000 and valid weekly hours into business A'
);

select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode) values ('a2000000-0000-0000-0000-0000000000b2', 'Cross', 'x', '93210')$$,
  '42501', null, 'member A cannot insert into business B'
);

select is(
  (with u as (update public.pickup_locations set name = 'Hacked' where business_id = 'a2000000-0000-0000-0000-0000000000b2'::uuid returning 1) select count(*)::int from u),
  0,
  'member A cannot update business B locations'
);

select is(
  (with d as (delete from public.pickup_locations where business_id = 'a2000000-0000-0000-0000-0000000000b2'::uuid returning 1) select count(*)::int from d),
  0,
  'member A cannot delete business B locations'
);

select throws_ok(
  $$update public.pickup_locations set business_id = 'a2000000-0000-0000-0000-0000000000b2' where id = 'e1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'member A cannot move a location to business B'
);

select is(
  (with u as (update public.pickup_locations set is_active = true, fee_cents = 200 where id = 'e1000000-0000-0000-0000-000000000002'::uuid returning 1) select count(*)::int from u),
  1,
  'member A can update a location of business A'
);

-- Column checks
select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode) values ('a1000000-0000-0000-0000-0000000000a1', 'Bad postcode', 'x', '9321')$$,
  '23514', null, 'a 4-digit postcode is rejected'
);
select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode, fee_cents) values ('a1000000-0000-0000-0000-0000000000a1', 'Dear', 'x', '93210', 10001)$$,
  '23514', null, 'a fee over 10000 cents is rejected'
);
select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode, fee_cents) values ('a1000000-0000-0000-0000-0000000000a1', 'Negative', 'x', '93210', -1)$$,
  '23514', null, 'a negative fee is rejected'
);
select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode, weekly_hours) values ('a1000000-0000-0000-0000-0000000000a1', 'Bad hours', 'x', '93210', '{"mon": []}'::jsonb)$$,
  '23514', null, 'invalid weekly_hours are rejected'
);
select throws_ok(
  format($$insert into public.pickup_locations (business_id, name, description, address, postcode) values ('a1000000-0000-0000-0000-0000000000a1', 'Long', %L, 'x', '93210')$$, repeat('x', 201)),
  '23514', null, 'a description over 200 characters is rejected'
);

-- Limit: 20 per business (A has 3 rows now)
select lives_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode, sort_order)
    select 'a1000000-0000-0000-0000-0000000000a1', 'Filler ' || g, 'x', '93210', 10 + g
    from generate_series(1, 17) g$$,
  'member A can fill business A up to 20 locations'
);

select throws_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode) values ('a1000000-0000-0000-0000-0000000000a1', 'Twenty-first', 'x', '93210')$$,
  '23514', null, 'a 21st location is rejected'
);

-- Settings: managers can switch shop pickup off
select lives_ok(
  $$update public.business_settings set shop_pickup_enabled = false where business_id = 'a1000000-0000-0000-0000-0000000000a1'$$,
  'member A can turn shop pickup off'
);

-- Member A can delete their own location
select is(
  (with d as (delete from public.pickup_locations where id = 'e1000000-0000-0000-0000-000000000001'::uuid returning 1) select count(*)::int from d),
  1,
  'member A can delete a location of business A'
);

-- ----------------------------------------------------------------------------
-- Cascade (as the migration role)
-- ----------------------------------------------------------------------------
reset role;

delete from public.businesses where id = 'a3000000-0000-0000-0000-0000000000c3'::uuid;

select is(
  (select count(*)::int from public.pickup_locations where business_id = 'a3000000-0000-0000-0000-0000000000c3'::uuid),
  0,
  'deleting a business deletes its pickup locations'
);

select * from finish();

rollback;
