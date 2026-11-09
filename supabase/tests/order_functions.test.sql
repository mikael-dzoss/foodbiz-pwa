-- ============================================================================
-- Test Suite: order_functions.test.sql (#121)
-- Description: pgTAP tests verifying atomic order placement, stock decrement,
--              sequential stock depletion, blind guest find-or-create resolution,
--              service_role & channel authorization hardening, and atomic order
--              cancellation with stock restoration.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(45);

-- ----------------------------------------------------------------------------
-- Test Seeds
-- ----------------------------------------------------------------------------

-- 1. Ensure table grants for standard Supabase API roles
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant temp on database postgres to anon, authenticated, service_role;

-- 2. Auth users
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'authenticated', 'authenticated', 'member_a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'authenticated', 'authenticated', 'non_member@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

-- 3. Businesses
insert into public.businesses (id, name, slug, currency)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Business A', 'biz-a', 'EUR'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Business B', 'biz-b', 'EUR'),
  ('30000000-0000-0000-0000-000000000003'::uuid, 'Business C', 'biz-c', 'EUR'),
  ('40000000-0000-0000-0000-000000000004'::uuid, 'Business D', 'biz-d', 'EUR'),
  ('50000000-0000-0000-0000-000000000005'::uuid, 'Business E', 'biz-e', 'EUR')
on conflict (id) do nothing;

-- 4. Business Members
insert into public.business_members (id, business_id, user_id, role)
values
  ('ba000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner'),
  ('ba000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner'),
  ('ba000000-0000-0000-0000-000000000004'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner'),
  ('ba000000-0000-0000-0000-000000000005'::uuid, '50000000-0000-0000-0000-000000000005'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner')
on conflict (business_id, user_id) do nothing;

-- 5. Business Settings
insert into public.business_settings (id, business_id, currency, date_format, delivery_fee, min_order_amount, accepting_orders, service_types)
values
  ('5a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'EUR', 'DD/MM/YYYY', 350, 0, true, '{"pickup": true, "delivery": true, "dineIn": true}'::jsonb),
  ('5b000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'EUR', 'DD/MM/YYYY', 0, 0, true, '{"pickup": true, "delivery": true, "dineIn": true}'::jsonb),
  ('5c000000-0000-0000-0000-000000000003'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, 'EUR', 'DD/MM/YYYY', 0, 0, false, '{"pickup": true, "delivery": true, "dineIn": true}'::jsonb),
  ('5d000000-0000-0000-0000-000000000004'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 'EUR', 'DD/MM/YYYY', 0, 2000, true, '{"pickup": true, "delivery": true, "dineIn": true}'::jsonb),
  ('5e000000-0000-0000-0000-000000000005'::uuid, '50000000-0000-0000-0000-000000000005'::uuid, 'EUR', 'DD/MM/YYYY', 0, 0, true, '{"pickup": true, "delivery": false, "dineIn": true}'::jsonb)
on conflict (business_id) do update set
  delivery_fee = excluded.delivery_fee,
  min_order_amount = excluded.min_order_amount,
  accepting_orders = excluded.accepting_orders,
  service_types = excluded.service_types;

-- 6. Product Categories
insert into public.product_categories (id, business_id, name, sort_order)
values
  ('ca000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Category A', 0),
  ('cc000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, 'Category C', 0),
  ('cd000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 'Category D', 0),
  ('ce000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000005'::uuid, 'Category E', 0)
on conflict (id) do nothing;

-- 7. Products
-- da01: stock 10, visible true, price 500
-- da02: stock 1, visible true, price 1200 (for last item sequential depletion test)
-- da03: stock 5, visible false, price 800 (hidden product)
insert into public.products (id, business_id, category_id, name, price, stock, visible)
values
  ('da000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Croissant', 500, 10, true),
  ('da000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Last Sourdough', 1200, 1, true),
  ('da000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Secret Cake', 800, 5, false),
  ('dc000000-0000-0000-0000-000000000001'::uuid, '30000000-0000-0000-0000-000000000003'::uuid, 'cc000000-0000-0000-0000-000000000001'::uuid, 'Paused Brioche', 500, 10, true),
  ('dd000000-0000-0000-0000-000000000001'::uuid, '40000000-0000-0000-0000-000000000004'::uuid, 'cd000000-0000-0000-0000-000000000001'::uuid, 'Min Order Baguette', 500, 10, true),
  ('de000000-0000-0000-0000-000000000001'::uuid, '50000000-0000-0000-0000-000000000005'::uuid, 'ce000000-0000-0000-0000-000000000001'::uuid, 'Pickup Only Eclair', 500, 10, true)
on conflict (id) do nothing;

-- 8. Existing order for status checks
insert into public.guests (id, business_id, name, phone)
values
  ('9a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Existing Customer', '+33699990000')
on conflict (id) do nothing;

insert into public.orders (
  id,
  business_id,
  order_number,
  guest_id,
  service_type,
  channel,
  status,
  paid,
  requested_date,
  total_amount,
  tracking_token
) values (
  '0a000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  1,
  '9a000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'storefront',
  'NEW',
  'unpaid',
  current_date,
  500,
  'token-seeded-order-1'
) on conflict (id) do nothing;

insert into public.order_items (
  id,
  order_id,
  business_id,
  product_id,
  product_name,
  quantity,
  unit_price,
  total_price
) values (
  '1a000000-0000-0000-0000-000000000001'::uuid,
  '0a000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'da000000-0000-0000-0000-000000000001'::uuid,
  'Croissant',
  1,
  500,
  500
) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Section 1: public.find_or_create_guest (Tests 1-4)
-- Security: Revoked from anon and authenticated; granted only to service_role (#121 / C2, L2)
-- ----------------------------------------------------------------------------

-- Test 1: Direct call by anon fails with 42501
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

select throws_ok(
  $$select public.find_or_create_guest('10000000-0000-0000-0000-000000000001'::uuid, 'Alice', '+33600000099')$$,
  '42501',
  'permission denied for function find_or_create_guest',
  'find_or_create_guest direct call by anon fails with 42501'
);

-- Test 2: Direct call by authenticated fails with 42501
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select throws_ok(
  $$select public.find_or_create_guest('10000000-0000-0000-0000-000000000001'::uuid, 'Alice', '+33600000099')$$,
  '42501',
  'permission denied for function find_or_create_guest',
  'find_or_create_guest direct call by authenticated fails with 42501'
);

-- Test 3: Direct call by service_role succeeds
set local role service_role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role": "service_role"}';

select is(
  (public.find_or_create_guest('10000000-0000-0000-0000-000000000001'::uuid, '  Service   Caller  ', '+33600000098')->>'isNew')::boolean,
  true,
  'find_or_create_guest direct call by service_role succeeds'
);

-- Test 4: Name normalization on direct call under service_role
set local role postgres;

select is(
  (select name from public.guests where phone = '+33600000098'),
  'Service Caller',
  'find_or_create_guest normalizes and trims name'
);

-- ----------------------------------------------------------------------------
-- Section 2: public.place_order storefront & blind guest resolution (Tests 5-16)
-- ----------------------------------------------------------------------------

-- Switch to anon for storefront order placement
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- Test 5-7: Place order for new guest as anon
create temp table t_order_1 on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Charlie Brown',
  '+33600000002',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 2}]'::jsonb
) as res;
grant select on t_order_1 to public;

-- Test 5: Returns total_amount = 1000 (pickup ignores delivery fee)
select is(
  ((select res->>'total_amount' from t_order_1)::int),
  1000,
  'place_order returns correct total_amount for storefront pickup'
);

-- Test 6: Result does not expose guest_id (L1)
select is(
  (select (res ? 'guest_id') from t_order_1),
  false,
  'place_order result does not expose guest_id (L1)'
);

-- Test 7: Result contains sanitized keys (order_id, order_number, tracking_token, total_amount)
select ok(
  (select res ? 'order_id' and res ? 'order_number' and res ? 'tracking_token' and res ? 'total_amount' from t_order_1),
  'place_order returns sanitized fields (order_id, order_number, tracking_token, total_amount)'
);

-- Test 8: Decrements product stock from 10 to 8
select is(
  (select stock from public.products where id = 'da000000-0000-0000-0000-000000000001'),
  8,
  'place_order decrements product stock from 10 to 8'
);

-- Switch to postgres to inspect RLS-protected tables (orders, order_items)
set local role postgres;

-- Test 9: Creates order with guest_id NOT NULL and submitted_name IS NULL
select ok(
  (select guest_id is not null and submitted_name is null from public.orders where id = (select (res->>'order_id')::uuid from t_order_1)),
  'place_order sets guest_id NOT NULL and submitted_name IS NULL for matching name'
);

-- Test 10: Creates order_items snapshot row
select is(
  (select count(*)::int from public.order_items where order_id = (select (res->>'order_id')::uuid from t_order_1)),
  1,
  'place_order creates order_items snapshot row'
);

-- Switch back to anon for repeat order test
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- Test 11-12: Repeat place_order by anon with differing name preserves canonical name and sets submitted_name
create temp table t_order_2 on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Charlie Brown Jr',
  '+33600000002',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
) as res;
grant select on t_order_2 to public;

-- Switch to postgres to inspect RLS-protected tables (guests, orders)
set local role postgres;

-- Test 11: Canonical guest name preserved
select is(
  (select name from public.guests where phone = '+33600000002'),
  'Charlie Brown',
  'repeat place_order preserves original guest name'
);

-- Test 12: Mismatched name recorded in orders.submitted_name
select is(
  (select submitted_name from public.orders where id = (select (res->>'order_id')::uuid from t_order_2)),
  'Charlie Brown Jr',
  'repeat place_order records mismatched name in submitted_name'
);

-- Test 13: Anon cannot rename canonical guest even when p_update_guest_name=true
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

create temp table t_order_anon_rename on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Charlie Anon Rename',
  '+33600000002',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
  null,
  'on_handover'::public.order_payment_preference,
  null,
  null,
  true
) as res;
grant select on t_order_anon_rename to public;

set local role postgres;

select is(
  (select name from public.guests where phone = '+33600000002'),
  'Charlie Brown',
  'anon caller cannot rename guest even with p_update_guest_name=true'
);

-- Test 14: Authenticated non-member cannot rename canonical guest even when p_update_guest_name=true
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

create temp table t_order_nonmember_rename on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Charlie NonMember',
  '+33600000002',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
  null,
  'on_handover'::public.order_payment_preference,
  null,
  null,
  true
) as res;
grant select on t_order_nonmember_rename to public;

set local role postgres;

select is(
  (select name from public.guests where phone = '+33600000002'),
  'Charlie Brown',
  'authenticated non-member cannot rename guest even with p_update_guest_name=true'
);

-- Test 15-16: Repeat place_order by authenticated manager with p_update_guest_name=true
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

create temp table t_order_3 on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Charlie Senior',
  '+33600000002',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
  null,
  'on_handover'::public.order_payment_preference,
  null,
  null,
  true
) as res;
grant select on t_order_3 to public;

-- Test 15: Updates guest name
select is(
  (select name from public.guests where phone = '+33600000002'),
  'Charlie Senior',
  'place_order by manager with p_update_guest_name=true updates guest name'
);

-- Test 16: Leaves submitted_name null
select is(
  (select submitted_name from public.orders where id = (select (res->>'order_id')::uuid from t_order_3)),
  null,
  'place_order with updated guest name leaves submitted_name null'
);

-- ----------------------------------------------------------------------------
-- Section 3: Sequential stock depletion & visibility (Tests 17-21, H9)
-- ----------------------------------------------------------------------------

-- Reset role to anon
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- Test 17-19: Sequential stock depletion test on last item in stock (stock = 1)
create temp table t_order_last on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'First Buyer',
  '+33600000003',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000002", "quantity": 1}]'::jsonb
) as res;
grant select on t_order_last to public;

-- Test 17: First order succeeds and decrements stock to 0
select is(
  (select stock from public.products where id = 'da000000-0000-0000-0000-000000000002'),
  0,
  'first order for last item succeeds and decrements stock to 0'
);

-- Test 18: Second sequential order rejected with INSUFFICIENT_STOCK (P0001, honest description #121 / H9)
select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Second Buyer',
    '+33600000004',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "da000000-0000-0000-0000-000000000002", "quantity": 1}]'::jsonb
  )$$,
  'P0001',
  null,
  'second sequential order for the last unit is rejected with INSUFFICIENT_STOCK'
);

-- Test 19: Stock remains 0 after failed order rollback
select is(
  (select stock from public.products where id = 'da000000-0000-0000-0000-000000000002'),
  0,
  'stock remains 0 after failed order rollback'
);

-- Test 20: Storefront rejects ordering hidden product
select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Sneaky Buyer',
    '+33600000005',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "da000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb
  )$$,
  'P0003',
  null,
  'storefront rejects ordering hidden product'
);

-- Test 21: Aggregated duplicate lines in p_items consolidate quantity
-- Current stock for da01 is 4 (10 - 2 - 1 - 1 - 1 - 1 = 4). Ordering 1 + 2 = 3 leaves stock = 1.
create temp table t_order_dups on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Bulk Buyer',
  '+33600000006',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[
    {"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1},
    {"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 2}
  ]'::jsonb
) as res;
grant select on t_order_dups to public;

-- Switch to postgres to inspect RLS-protected order_items table
set local role postgres;

select is(
  (select quantity from public.order_items where order_id = (select (res->>'order_id')::uuid from t_order_dups)),
  3,
  'consolidated order_item has aggregated quantity of 3'
);

-- ----------------------------------------------------------------------------
-- Section 4: Channel hardening & business settings validations (Tests 22-35, C3, H1)
-- ----------------------------------------------------------------------------

-- Test 22: Anon attempting non-storefront channel throws 42501 (UNAUTHORIZED_CHANNEL)
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Phone Caller',
    '+33600000010',
    'pickup'::public.order_service_type,
    'phone'::public.order_channel,
    current_date,
    '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
  )$$,
  '42501',
  null,
  'anon attempting non-storefront channel throws 42501 (UNAUTHORIZED_CHANNEL)'
);

-- Test 23: Authenticated non-member attempting non-storefront channel throws 42501 (UNAUTHORIZED_CHANNEL)
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Phone Caller',
    '+33600000010',
    'pickup'::public.order_service_type,
    'phone'::public.order_channel,
    current_date,
    '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
  )$$,
  '42501',
  null,
  'authenticated non-member attempting non-storefront channel throws 42501 (UNAUTHORIZED_CHANNEL)'
);

-- Test 24: Authenticated member CAN place order via non-storefront channel and purchase hidden product
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

create temp table t_order_member_phone on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Phone Guest',
  '+33600000011',
  'pickup'::public.order_service_type,
  'phone'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb
) as res;
grant select on t_order_member_phone to public;

select is(
  ((select res->>'total_amount' from t_order_member_phone)::int),
  800,
  'authenticated member can place order via phone channel and purchase hidden product'
);

-- Test 25: Service_role CAN place order via non-storefront channel
set local role service_role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role": "service_role"}';

create temp table t_order_service_role on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Counter Guest',
  '+33600000012',
  'pickup'::public.order_service_type,
  'in-person'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb
) as res;
grant select on t_order_service_role to public;

select ok(
  (select res ? 'order_id' from t_order_service_role),
  'service_role can place order via non-storefront in-person channel'
);

-- Switch back to anon for storefront checks
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- Test 26: Non-existent business throws P0002
select throws_ok(
  $$select public.place_order(
    'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
    'Lost Guest',
    '+33600000013',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
  )$$,
  'P0002',
  null,
  'place_order throws P0002 for non-existent business'
);

-- Test 27: Storefront rejects order when accepting_orders is false (P0004 ORDERS_NOT_ACCEPTED)
select throws_ok(
  $$select public.place_order(
    '30000000-0000-0000-0000-000000000003'::uuid,
    'Blocked Guest',
    '+33600000014',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "dc000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
  )$$,
  'P0004',
  null,
  'storefront rejects order when business_settings.accepting_orders is false (P0004)'
);

-- Test 28: Storefront rejects order below min_order_amount (P0005 MINIMUM_ORDER_AMOUNT_NOT_MET)
select throws_ok(
  $$select public.place_order(
    '40000000-0000-0000-0000-000000000004'::uuid,
    'Small Guest',
    '+33600000015',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "dd000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
  )$$,
  'P0005',
  null,
  'storefront rejects order below min_order_amount (P0005)'
);

-- Test 29: Storefront rejects disabled service type in business_settings (22023)
select throws_ok(
  $$select public.place_order(
    '50000000-0000-0000-0000-000000000005'::uuid,
    'Delivery Seeker',
    '+33600000016',
    'delivery'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "de000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
    null,
    'on_handover'::public.order_payment_preference,
    '123 Street'
  )$$,
  '22023',
  null,
  'storefront rejects disabled service type in business_settings (22023)'
);

-- Test 30: Delivery service type requires non-empty delivery_address (22023)
select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'No Address Guest',
    '+33600000017',
    'delivery'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
    null,
    'on_handover'::public.order_payment_preference,
    null
  )$$,
  '22023',
  null,
  'delivery service type requires non-empty delivery_address (22023)'
);

-- Test 31: Delivery order adds delivery_fee (350) to total_amount (subtotal 500 + fee 350 = 850)
create temp table t_order_delivery on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Delivered Guest',
  '+33600000018',
  'delivery'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
  null,
  'on_handover'::public.order_payment_preference,
  '123 Baker Street'
) as res;
grant select on t_order_delivery to public;

select is(
  ((select res->>'total_amount' from t_order_delivery)::int),
  850,
  'delivery order adds delivery_fee to total_amount (500 + 350 = 850)'
);

-- Switch to postgres to inspect orders table for delivery_address (H1)
set local role postgres;

-- Test 32: Stores delivery_address in public.orders (H1)
select is(
  (select delivery_address from public.orders where id = (select (res->>'order_id')::uuid from t_order_delivery)),
  '123 Baker Street',
  'delivery order stores delivery_address in orders table (H1)'
);

-- Switch back to anon
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- Test 33: Notes exceeding 500 characters rejected with 22023
select throws_ok(
  format($$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Long Notes Guest',
    '+33600000019',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
    null,
    'on_handover'::public.order_payment_preference,
    null,
    '%s'
  )$$, repeat('a', 501)),
  '22023',
  null,
  'notes exceeding 500 characters rejected with 22023'
);

-- Test 34: Storefront rejects requested_date in past (< current_date - 1) with 22023
select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Time Traveler',
    '+33600000020',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date - 2,
    '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
  )$$,
  '22023',
  null,
  'storefront rejects requested_date in past (< current_date - 1)'
);

-- Test 35: Storefront accepts requested_date = current_date - 1 (lenient timezone threshold)
create temp table t_order_past_tolerated on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Yesterday Guest',
  '+33600000021',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date - 1,
  '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
) as res;
grant select on t_order_past_tolerated to public;

select ok(
  (select res ? 'order_id' from t_order_past_tolerated),
  'storefront accepts requested_date = current_date - 1'
);

-- ----------------------------------------------------------------------------
-- Section 5: public.cancel_order (Tests 36-45, M10)
-- ----------------------------------------------------------------------------

-- Switch to authenticated manager of Biz A
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

create temp table t_cancel_res on commit drop as
select public.cancel_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  (select (res->>'order_id')::uuid from t_order_dups),
  'Customer cancelled order'
) as res;
grant select on t_cancel_res to public;

-- Test 36: Returns CANCELLED status
select is(
  (select res->>'status' from t_cancel_res),
  'CANCELLED',
  'cancel_order returns status CANCELLED'
);

-- Test 37: Returns cancellation_reason
select is(
  (select res->>'cancellation_reason' from t_cancel_res),
  'Customer cancelled order',
  'cancel_order returns cancellation_reason'
);

-- Test 38: Orders table updated to CANCELLED
select is(
  (select status from public.orders where id = (select (res->>'order_id')::uuid from t_order_dups)),
  'CANCELLED'::public.order_status,
  'orders table status is CANCELLED'
);

-- Test 39: Restores product stock atomically (3 restored: 1 + 3 = 4)
select is(
  (select stock from public.products where id = 'da000000-0000-0000-0000-000000000001'),
  4,
  'cancel_order atomically restores product stock'
);

-- Test 40: Blocks anon caller with 42501
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

select throws_ok(
  $$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '0a000000-0000-0000-0000-000000000001'::uuid,
    'Anon cancel'
  )$$,
  '42501',
  null,
  'cancel_order blocks anon with 42501'
);

-- Test 41: Blocks authenticated non-member caller with 42501
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '0a000000-0000-0000-0000-000000000001'::uuid,
    'Non-member cancel'
  )$$,
  '42501',
  null,
  'cancel_order blocks authenticated non-member with 42501'
);

-- Test 42: Allows service_role to call cancel_order and succeeds (M10)
set local role service_role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role": "service_role"}';

select is(
  (public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    (select (res->>'order_id')::uuid from t_order_delivery),
    'Service cancellation'
  )->>'status'),
  'CANCELLED',
  'cancel_order allows service_role to cancel order (M10)'
);

-- Switch back to Biz A manager
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Test 43: Blocks cancelling an already CANCELLED order
select throws_ok(
  format($$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '%s'::uuid,
    'Second cancel'
  )$$, (select (res->>'order_id')::uuid from t_order_dups)),
  '22023',
  null,
  'cancel_order blocks cancelling already cancelled order (22023)'
);

-- Test 44: Blocks cancelling a COMPLETED order
set local role postgres;
update public.orders
set status = 'COMPLETED'
where id = '0a000000-0000-0000-0000-000000000001'::uuid;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select throws_ok(
  $$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '0a000000-0000-0000-0000-000000000001'::uuid,
    'Cancel completed'
  )$$,
  '22023',
  null,
  'cancel_order blocks cancelling a completed order (22023)'
);

-- Test 45: Blocks cancelling a non-existent order (P0002)
select throws_ok(
  $$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
    'Cancel missing'
  )$$,
  'P0002',
  null,
  'cancel_order throws P0002 for non-existent order'
);

select * from finish();
rollback;
