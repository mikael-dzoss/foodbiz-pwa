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

select plan(60);

-- ----------------------------------------------------------------------------
-- Seeds (as the migration role)
-- ----------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('c1111111-1111-1111-1111-111111111111'::uuid, 'authenticated', 'authenticated', 'pl_member_a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'authenticated', 'authenticated', 'pl_outsider@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('c3333333-3333-3333-3333-333333333333'::uuid, 'authenticated', 'authenticated', 'pl_multi@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.businesses (id, name, slug, currency)
values
  ('a1000000-0000-0000-0000-0000000000a1'::uuid, 'PL Business A', 'pl-biz-a', 'EUR'),
  ('a2000000-0000-0000-0000-0000000000b2'::uuid, 'PL Business B', 'pl-biz-b', 'EUR'),
  ('a3000000-0000-0000-0000-0000000000c3'::uuid, 'PL Business C', 'pl-biz-c', 'EUR'),
  ('a4000000-0000-0000-0000-0000000000d4'::uuid, 'PL Business D', 'pl-biz-d', 'EUR'),
  ('a5000000-0000-0000-0000-0000000000e5'::uuid, 'PL Business E', 'pl-biz-e', 'EUR');

insert into public.business_members (business_id, user_id, role)
values
  ('a1000000-0000-0000-0000-0000000000a1'::uuid, 'c1111111-1111-1111-1111-111111111111'::uuid, 'manager'),
  ('a4000000-0000-0000-0000-0000000000d4'::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, 'manager'),
  ('a5000000-0000-0000-0000-0000000000e5'::uuid, 'c3333333-3333-3333-3333-333333333333'::uuid, 'manager');

insert into public.business_settings (business_id)
values
  ('a1000000-0000-0000-0000-0000000000a1'::uuid),
  ('a2000000-0000-0000-0000-0000000000b2'::uuid);

-- D: pickup on, shop off, one active relay (the "last option"); E: same, for the cascade test.
insert into public.business_settings (business_id, shop_pickup_enabled)
values
  ('a4000000-0000-0000-0000-0000000000d4'::uuid, false),
  ('a5000000-0000-0000-0000-0000000000e5'::uuid, false);

insert into public.pickup_locations (id, business_id, name, address, postcode, fee_cents, is_active, sort_order)
values
  ('e1000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-0000000000a1'::uuid, 'A active', '1 Rue A', '93210', 0, true, 0),
  ('e1000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-0000000000a1'::uuid, 'A inactive', '2 Rue A', '93210', 150, false, 1),
  ('e2000000-0000-0000-0000-000000000001'::uuid, 'a2000000-0000-0000-0000-0000000000b2'::uuid, 'B active', '1 Rue B', '93200', 0, true, 0),
  ('e2000000-0000-0000-0000-000000000002'::uuid, 'a2000000-0000-0000-0000-0000000000b2'::uuid, 'B inactive', '2 Rue B', '93200', 0, false, 1),
  ('e3000000-0000-0000-0000-000000000001'::uuid, 'a3000000-0000-0000-0000-0000000000c3'::uuid, 'C active', '1 Rue C', '75001', 0, true, 0),
  ('e4000000-0000-0000-0000-000000000001'::uuid, 'a4000000-0000-0000-0000-0000000000d4'::uuid, 'D one', '1 Rue D', '75001', 0, true, 0),
  ('e4000000-0000-0000-0000-000000000002'::uuid, 'a4000000-0000-0000-0000-0000000000d4'::uuid, 'D two', '2 Rue D', '75001', 0, false, 1),
  ('e5000000-0000-0000-0000-000000000001'::uuid, 'a5000000-0000-0000-0000-0000000000e5'::uuid, 'E one', '1 Rue E', '75001', 0, true, 0);

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
  5,
  'anon sees only the 5 active locations across businesses'
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
select is(
  (with u as (update public.business_settings set shop_pickup_enabled = false where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid returning 1) select count(*)::int from u),
  1,
  'member A can turn shop pickup off (1 row updated)'
);

select is(
  (select shop_pickup_enabled from public.business_settings where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid),
  false,
  'shop_pickup_enabled reads back false'
);

-- Another business's row cannot be reached by id
select is(
  (with u as (update public.pickup_locations set name = 'Hacked' where id = 'e2000000-0000-0000-0000-000000000001'::uuid returning 1) select count(*)::int from u),
  0,
  'member A cannot update a business B location by id'
);
select is(
  (with d as (delete from public.pickup_locations where id = 'e2000000-0000-0000-0000-000000000001'::uuid returning 1) select count(*)::int from d),
  0,
  'member A cannot delete a business B location by id'
);

-- Atomic reorder (security invoker): must name exactly the business's locations
select lives_ok(
  format($$select public.reorder_pickup_locations('a1000000-0000-0000-0000-0000000000a1', %L::uuid[])$$,
    (select array_agg(id order by sort_order desc)::text from public.pickup_locations where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid)),
  'member A can reorder the full set of business A locations'
);
select is(
  (select array_agg(sort_order order by sort_order) from public.pickup_locations where business_id = 'a1000000-0000-0000-0000-0000000000a1'::uuid),
  (select array_agg(g) from generate_series(0, 19) g),
  'reorder assigns sort_order 0..19 in one statement'
);
select throws_ok(
  $$select public.reorder_pickup_locations('a1000000-0000-0000-0000-0000000000a1', array['e1000000-0000-0000-0000-000000000001']::uuid[])$$,
  '22023', null, 'reorder with a partial id set is rejected'
);
select throws_ok(
  $$select public.reorder_pickup_locations('a1000000-0000-0000-0000-0000000000a1', array['e2000000-0000-0000-0000-000000000001']::uuid[])$$,
  '22023', null, 'reorder with another business''s id is rejected'
);

-- Member A can delete their own location
select is(
  (with d as (delete from public.pickup_locations where id = 'e1000000-0000-0000-0000-000000000001'::uuid returning 1) select count(*)::int from d),
  1,
  'member A can delete a location of business A'
);

-- ----------------------------------------------------------------------------
-- business_id is immutable (member of two businesses cannot move a location)
-- ----------------------------------------------------------------------------
set local "request.jwt.claim.sub" = 'c3333333-3333-3333-3333-333333333333';
set local "request.jwt.claims" = '{"sub": "c3333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select throws_ok(
  $$update public.pickup_locations set business_id = 'a5000000-0000-0000-0000-0000000000e5' where id = 'e4000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a member of two businesses cannot move a location between them'
);

-- ----------------------------------------------------------------------------
-- service_role can write
-- ----------------------------------------------------------------------------
set local role service_role;

select lives_ok(
  $$insert into public.pickup_locations (id, business_id, name, address, postcode) values ('e2000000-0000-0000-0000-000000000009', 'a2000000-0000-0000-0000-0000000000b2', 'B service', 'x', '93200')$$,
  'service_role can insert'
);
select lives_ok(
  $$update public.pickup_locations set name = 'B service 2' where id = 'e2000000-0000-0000-0000-000000000009'$$,
  'service_role can update'
);
select lives_ok(
  $$delete from public.pickup_locations where id = 'e2000000-0000-0000-0000-000000000009'$$,
  'service_role can delete'
);

-- ----------------------------------------------------------------------------
-- As the migration role: updated_at, per-business cap, last-option trigger, cascade
-- ----------------------------------------------------------------------------
reset role;

-- (an INSERT keeps the supplied updated_at; the BEFORE UPDATE trigger then refreshes it)
insert into public.pickup_locations (id, business_id, name, address, postcode, updated_at)
values ('e3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-0000000000c3', 'C old', 'x', '75001', '2020-01-01T00:00:00Z');
update public.pickup_locations set name = 'C renamed' where id = 'e3000000-0000-0000-0000-000000000002'::uuid;
select ok(
  (select updated_at > '2020-01-01T00:00:00Z'::timestamptz from public.pickup_locations where id = 'e3000000-0000-0000-0000-000000000002'::uuid),
  'updated_at is refreshed on update'
);

-- A is full (20): business B (2 rows) can still insert
select lives_ok(
  $$insert into public.pickup_locations (business_id, name, address, postcode) values ('a2000000-0000-0000-0000-0000000000b2', 'B third', 'x', '93200')$$,
  'the 20-location cap is per business (B can insert while A is full)'
);

-- D: pickup on, shop off, "D one" is the only active location
select throws_ok(
  $$update public.pickup_locations set is_active = false where id = 'e4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'deactivating the last active location is rejected'
);
select throws_ok(
  $$delete from public.pickup_locations where id = 'e4000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'deleting the last active location is rejected'
);
select lives_ok(
  $$update public.pickup_locations set is_active = true where id = 'e4000000-0000-0000-0000-000000000002'$$,
  'activating another location is allowed'
);
select lives_ok(
  $$update public.pickup_locations set is_active = false where id = 'e4000000-0000-0000-0000-000000000001'$$,
  'deactivating a location is allowed while another stays active'
);
select throws_ok(
  $$update public.pickup_locations set is_active = false where id = 'e4000000-0000-0000-0000-000000000002'$$,
  '23514', null, 'deactivating the now-last location is rejected'
);
select lives_ok(
  $$update public.business_settings set shop_pickup_enabled = true where business_id = 'a4000000-0000-0000-0000-0000000000d4'$$,
  'turning shop pickup on is allowed'
);
select lives_ok(
  $$update public.pickup_locations set is_active = false where id = 'e4000000-0000-0000-0000-000000000002'$$,
  'the last relay can be deactivated while the shop is a pickup option'
);
select throws_ok(
  $$update public.business_settings set shop_pickup_enabled = false where business_id = 'a4000000-0000-0000-0000-0000000000d4'$$,
  '23514', null, 'turning shop pickup off without any active relay is rejected'
);
select lives_ok(
  $$update public.business_settings set service_types = '{"pickup": false, "delivery": true, "dineIn": true}'::jsonb where business_id = 'a4000000-0000-0000-0000-0000000000d4'$$,
  'switching the pickup service type off is allowed'
);
select lives_ok(
  $$update public.business_settings set shop_pickup_enabled = false where business_id = 'a4000000-0000-0000-0000-0000000000d4'$$,
  'the rule does not apply while the pickup service type is off'
);
select throws_ok(
  $$update public.business_settings set service_types = '{"pickup": true, "delivery": true, "dineIn": true}'::jsonb where business_id = 'a4000000-0000-0000-0000-0000000000d4'$$,
  '23514', null, 'switching pickup back on without any option is rejected'
);

-- Cascade: E has pickup on, shop off and a single active location
select lives_ok(
  $$delete from public.businesses where id = 'a5000000-0000-0000-0000-0000000000e5'$$,
  'deleting a business with a last active location still works (cascade)'
);

delete from public.businesses where id = 'a3000000-0000-0000-0000-0000000000c3'::uuid;

select is(
  (select count(*)::int from public.pickup_locations where business_id = 'a3000000-0000-0000-0000-0000000000c3'::uuid),
  0,
  'deleting a business deletes its pickup locations'
);

select * from finish();

rollback;
