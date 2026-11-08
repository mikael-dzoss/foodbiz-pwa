-- ============================================================================
-- Test Suite: order_functions.test.sql (#121)
-- Description: pgTAP tests verifying atomic order placement, stock decrement,
--              concurrency serialization, blind guest find-or-create resolution,
--              and atomic order cancellation with stock restoration.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(27);

-- ----------------------------------------------------------------------------
-- Test Seeds
-- ----------------------------------------------------------------------------

-- 1. Ensure table grants for standard Supabase API roles
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

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
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Business B', 'biz-b', 'EUR')
on conflict (id) do nothing;

-- 4. Business Members
insert into public.business_members (id, business_id, user_id, role)
values
  ('ba000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner')
on conflict (business_id, user_id) do nothing;

-- 5. Business Settings
insert into public.business_settings (id, business_id, currency, date_format)
values
  ('sa000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'EUR', 'DD/MM/YYYY'),
  ('sb000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'EUR', 'DD/MM/YYYY')
on conflict (business_id) do nothing;

-- 6. Product Categories
insert into public.product_categories (id, business_id, name, sort_order)
values
  ('ca000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Category A', 0)
on conflict (id) do nothing;

-- 7. Products
-- pa01: stock 10, visible true, price 500
-- pa02: stock 1, visible true, price 1200 (for last item concurrency test)
-- pa03: stock 5, visible false, price 800 (hidden product)
insert into public.products (id, business_id, category_id, name, price, stock, visible)
values
  ('pa000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Croissant', 500, 10, true),
  ('pa000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Last Sourdough', 1200, 1, true),
  ('pa000000-0000-0000-0000-000000000003'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Secret Cake', 800, 5, false)
on conflict (id) do nothing;

-- 8. Existing order for status checks
insert into public.guests (id, business_id, name, phone)
values
  ('ga000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Existing Customer', '+33699990000')
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
  'oa000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  1,
  'ga000000-0000-0000-0000-000000000001'::uuid,
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
  'ia000000-0000-0000-0000-000000000001'::uuid,
  'oa000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'pa000000-0000-0000-0000-000000000001'::uuid,
  'Croissant',
  1,
  500,
  500
) on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Section 1: public.find_or_create_guest (Tests 1-5)
-- ----------------------------------------------------------------------------

-- Test 1: Fresh guest creation returns isNew = true
select is(
  (public.find_or_create_guest('10000000-0000-0000-0000-000000000001'::uuid, '  Bob   Builder  ', '+33600000001')->>'isNew')::boolean,
  true,
  'find_or_create_guest returns isNew=true for fresh guest'
);

-- Test 2: Name normalization collapses whitespace
select is(
  (select name from public.guests where phone = '+33600000001'),
  'Bob Builder',
  'find_or_create_guest normalizes and trims guest name'
);

-- Test 3: Anon repeat with differing name flags mismatch
select is(
  (public.find_or_create_guest('10000000-0000-0000-0000-000000000001'::uuid, 'Bob The Destroyer', '+33600000001')->>'nameMismatch')::boolean,
  true,
  'find_or_create_guest flags nameMismatch=true when names differ'
);

-- Test 4: Canonical guest name is preserved on unprivileged mismatch
select is(
  (select name from public.guests where phone = '+33600000001'),
  'Bob Builder',
  'find_or_create_guest preserves canonical name when called without manager privileges'
);

-- Test 5: Authenticated manager with p_update_guest_name=true updates canonical name
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  (public.find_or_create_guest('10000000-0000-0000-0000-000000000001'::uuid, 'Bob The Destroyer', '+33600000001', null, true)->>'nameMismatch')::boolean,
  false,
  'find_or_create_guest returns nameMismatch=false when manager updates name'
);

-- Reset role to anon for storefront order placement tests
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- ----------------------------------------------------------------------------
-- Section 2: public.place_order (Tests 6-18)
-- ----------------------------------------------------------------------------

-- Test 6-9: Place order for new guest as anon
create temp table t_order_1 on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Charlie Brown',
  '+33600000002',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "pa000000-0000-0000-0000-000000000001", "quantity": 2}]'::jsonb
) as res;

-- Test 6: Returns total_amount = 1000
select is(
  ((select res->>'total_amount' from t_order_1)::int),
  1000,
  'place_order returns correct total_amount'
);

-- Test 7: Decrements product stock from 10 to 8
select is(
  (select stock from public.products where id = 'pa000000-0000-0000-0000-000000000001'),
  8,
  'place_order decrements product stock from 10 to 8'
);

-- Test 8: Creates order with guest_id NOT NULL and submitted_name IS NULL
select ok(
  (select guest_id is not null and submitted_name is null from public.orders where id = (select (res->>'order_id')::uuid from t_order_1)),
  'place_order sets guest_id NOT NULL and submitted_name IS NULL for matching name'
);

-- Test 9: Creates order_items snapshot row
select is(
  (select count(*)::int from public.order_items where order_id = (select (res->>'order_id')::uuid from t_order_1)),
  1,
  'place_order creates order_items snapshot row'
);

-- Test 10-11: Repeat place_order by anon with differing name preserves canonical name and sets submitted_name
create temp table t_order_2 on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Charlie Brown Jr',
  '+33600000002',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "pa000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb
) as res;

-- Test 10: Canonical guest name preserved
select is(
  (select name from public.guests where phone = '+33600000002'),
  'Charlie Brown',
  'repeat place_order preserves original guest name'
);

-- Test 11: Mismatched name recorded in orders.submitted_name
select is(
  (select submitted_name from public.orders where id = (select (res->>'order_id')::uuid from t_order_2)),
  'Charlie Brown Jr',
  'repeat place_order records mismatched name in submitted_name'
);

-- Test 12-13: Repeat place_order by authenticated manager with p_update_guest_name=true
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
  '[{"product_id": "pa000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
  null,
  'on_handover'::public.order_payment_preference,
  null,
  null,
  true
) as res;

-- Test 12: Updates guest name
select is(
  (select name from public.guests where phone = '+33600000002'),
  'Charlie Senior',
  'place_order by manager with p_update_guest_name=true updates guest name'
);

-- Test 13: Leaves submitted_name null
select is(
  (select submitted_name from public.orders where id = (select (res->>'order_id')::uuid from t_order_3)),
  null,
  'place_order with updated guest name leaves submitted_name null'
);

-- Reset role to anon
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- Test 14-16: Concurrency test on last item in stock (stock = 1)
create temp table t_order_last on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'First Buyer',
  '+33600000003',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[{"product_id": "pa000000-0000-0000-0000-000000000002", "quantity": 1}]'::jsonb
) as res;

-- Test 14: First order succeeds and decrements stock to 0
select is(
  (select stock from public.products where id = 'pa000000-0000-0000-0000-000000000002'),
  0,
  'first order for last item succeeds and decrements stock to 0'
);

-- Test 15: Second order throws INSUFFICIENT_STOCK (P0001)
select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Second Buyer',
    '+33600000004',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "pa000000-0000-0000-0000-000000000002", "quantity": 1}]'::jsonb
  )$$,
  'P0001',
  null,
  'second order for out-of-stock item throws P0001 (INSUFFICIENT_STOCK)'
);

-- Test 16: Stock remains 0 after failed order rollback
select is(
  (select stock from public.products where id = 'pa000000-0000-0000-0000-000000000002'),
  0,
  'stock remains 0 after failed order rollback'
);

-- Test 17: Storefront rejects ordering hidden product
select throws_ok(
  $$select public.place_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'Sneaky Buyer',
    '+33600000005',
    'pickup'::public.order_service_type,
    'storefront'::public.order_channel,
    current_date,
    '[{"product_id": "pa000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb
  )$$,
  'P0003',
  null,
  'storefront rejects ordering hidden product'
);

-- Test 18: Aggregated duplicate lines in p_items consolidate quantity
-- Current stock for pa01 is 6 (10 - 2 - 1 - 1 = 6). Ordering 1 + 2 = 3 leaves stock = 3.
create temp table t_order_dups on commit drop as
select public.place_order(
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Bulk Buyer',
  '+33600000006',
  'pickup'::public.order_service_type,
  'storefront'::public.order_channel,
  current_date,
  '[
    {"product_id": "pa000000-0000-0000-0000-000000000001", "quantity": 1},
    {"product_id": "pa000000-0000-0000-0000-000000000001", "quantity": 2}
  ]'::jsonb
) as res;

select is(
  (select quantity from public.order_items where order_id = (select (res->>'order_id')::uuid from t_order_dups)),
  3,
  'consolidated order_item has aggregated quantity of 3'
);

-- ----------------------------------------------------------------------------
-- Section 3: public.cancel_order (Tests 19-27)
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

-- Test 19: Returns CANCELLED status
select is(
  (select res->>'status' from t_cancel_res),
  'CANCELLED',
  'cancel_order returns status CANCELLED'
);

-- Test 20: Returns cancellation_reason
select is(
  (select res->>'cancellation_reason' from t_cancel_res),
  'Customer cancelled order',
  'cancel_order returns cancellation_reason'
);

-- Test 21: Orders table updated to CANCELLED
select is(
  (select status from public.orders where id = (select (res->>'order_id')::uuid from t_order_dups)),
  'CANCELLED'::public.order_status,
  'orders table status is CANCELLED'
);

-- Test 22: Restores product stock atomically (3 restored: 3 + 3 = 6)
select is(
  (select stock from public.products where id = 'pa000000-0000-0000-0000-000000000001'),
  6,
  'cancel_order atomically restores product stock'
);

-- Test 23: Blocks anon caller with 42501
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

select throws_ok(
  $$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'oa000000-0000-0000-0000-000000000001'::uuid,
    'Anon cancel'
  )$$,
  '42501',
  null,
  'cancel_order blocks anon with 42501'
);

-- Test 24: Blocks authenticated non-member caller with 42501
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'oa000000-0000-0000-0000-000000000001'::uuid,
    'Non-member cancel'
  )$$,
  '42501',
  null,
  'cancel_order blocks authenticated non-member with 42501'
);

-- Switch back to Biz A manager
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Test 25: Blocks cancelling an already CANCELLED order
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

-- Test 26: Blocks cancelling a COMPLETED order
update public.orders
set status = 'COMPLETED'
where id = 'oa000000-0000-0000-0000-000000000001'::uuid;

select throws_ok(
  $$select public.cancel_order(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'oa000000-0000-0000-0000-000000000001'::uuid,
    'Cancel completed'
  )$$,
  '22023',
  null,
  'cancel_order blocks cancelling a completed order (22023)'
);

-- Test 27: Blocks cancelling a non-existent order (P0002)
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
