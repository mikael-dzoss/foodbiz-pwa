-- ============================================================================
-- Test Suite: rls_policies.test.sql (#120)
-- Description: pgTAP tests verifying Row Level Security (RLS) enforcement,
--              tenant isolation between businesses, role segregation (anon vs
--              authenticated member), column-level privileges, and order tracking RPCs.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(49);

-- ----------------------------------------------------------------------------
-- Test Seeds
-- ----------------------------------------------------------------------------

-- 1. Ensure table grants for standard Supabase API roles
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- Re-apply column-level privilege restrictions on business_settings for anon (#120 / M8)
revoke select on public.business_settings from anon;
grant select (
  id,
  business_id,
  currency,
  accepting_orders,
  service_types,
  opening_hours,
  weekly_hours,
  hours_exceptions,
  shop_pickup_enabled,
  order_timing_asap,
  order_timing_scheduled,
  order_timing_time_optional,
  delivery_fee,
  min_order_amount,
  lead_time_value,
  lead_time_unit,
  timezone,
  revolut_revtag,
  wero_identifier,
  payment_methods,
  payment_instructions_en,
  payment_instructions_fr
) on public.business_settings to anon;

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
  ('5a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'EUR', 'DD/MM/YYYY'),
  ('5b000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'EUR', 'DD/MM/YYYY')
on conflict (business_id) do nothing;

-- 6. Product Categories
insert into public.product_categories (id, business_id, name, sort_order)
values
  ('ca000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Category A', 0),
  ('cb000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Category B', 0)
on conflict (id) do nothing;

-- 7. Products (visible and hidden for both Biz A and Biz B)
insert into public.products (id, business_id, category_id, name, price, stock, visible)
values
  ('da000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Visible Prod A', 1000, 10, true),
  ('da000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Hidden Prod A', 1200, 10, false),
  ('db000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'cb000000-0000-0000-0000-000000000002'::uuid, 'Visible Prod B', 2000, 10, true),
  ('db000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'cb000000-0000-0000-0000-000000000002'::uuid, 'Hidden Prod B', 2200, 10, false)
on conflict (id) do nothing;

-- 8. Guests
insert into public.guests (id, business_id, name, phone, email)
values
  ('9a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Alice Customer', '+33612345678', 'alice@example.com'),
  ('9b000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Bob Customer', '+33687654321', 'bob@example.com')
on conflict (id) do nothing;

-- 9. Orders & Order Items
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
  1000,
  'token-order-a-1234'
), (
  '0b000000-0000-0000-0000-000000000002'::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  1,
  '9b000000-0000-0000-0000-000000000002'::uuid,
  'delivery',
  'storefront',
  'NEW',
  'unpaid',
  current_date,
  2000,
  'token-order-b-5678'
)
on conflict (id) do nothing;

insert into public.order_items (id, order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
values
  ('1a000000-0000-0000-0000-000000000001'::uuid, '0a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'da000000-0000-0000-0000-000000000001'::uuid, 'Visible Prod A', 1, 1000, 1000)
on conflict (id) do nothing;

-- 10. Expenses
insert into public.expenses (id, business_id, amount, date, description, tags)
values
  ('ea000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 450, current_date, 'Ingredients A', array['supplies']),
  ('eb000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 890, current_date, 'Ingredients B', array['supplies'])
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Section 1: Verification that RLS is Enabled on All 9 Tables (Tests 1-9)
-- ----------------------------------------------------------------------------

select ok(relrowsecurity, 'businesses table has RLS enabled') from pg_class where relname = 'businesses';
select ok(relrowsecurity, 'business_members table has RLS enabled') from pg_class where relname = 'business_members';
select ok(relrowsecurity, 'business_settings table has RLS enabled') from pg_class where relname = 'business_settings';
select ok(relrowsecurity, 'product_categories table has RLS enabled') from pg_class where relname = 'product_categories';
select ok(relrowsecurity, 'products table has RLS enabled') from pg_class where relname = 'products';
select ok(relrowsecurity, 'guests table has RLS enabled') from pg_class where relname = 'guests';
select ok(relrowsecurity, 'orders table has RLS enabled') from pg_class where relname = 'orders';
select ok(relrowsecurity, 'order_items table has RLS enabled') from pg_class where relname = 'order_items';
select ok(relrowsecurity, 'expenses table has RLS enabled') from pg_class where relname = 'expenses';

-- ----------------------------------------------------------------------------
-- Section 2: Anonymous Role Tests (Tests 10-29)
-- ----------------------------------------------------------------------------

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

-- Anon read permissions (Tests 10-20)
-- Scoped to Biz A and Biz B to ensure robustness against seeded businesses (#120 / N1)
select is(
  (select count(*)::int from businesses where id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  2,
  'anon can read businesses public profiles'
);

select is(
  (select count(id)::int from business_settings where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  2,
  'anon can read public columns of business_settings'
);

select throws_ok(
  'select low_stock_threshold from business_settings',
  '42501',
  null,
  'anon cannot select private column low_stock_threshold from business_settings'
);

select is(
  (select count(*)::int from product_categories where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  2,
  'anon can read product_categories'
);

select is(
  (select count(*)::int from products where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  2,
  'anon sees only visible products of Biz A and Biz B (2 of 4 total)'
);

select is(
  (select count(*)::int from products where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid) and visible = false),
  0,
  'anon sees 0 hidden products of Biz A and Biz B'
);

select is(
  (select count(*)::int from guests where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  0,
  'anon cannot read guests directly'
);

select is(
  (select count(*)::int from orders where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  0,
  'anon cannot read orders directly'
);

select is(
  (select count(*)::int from order_items where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  0,
  'anon cannot read order_items directly'
);

select is(
  (select count(*)::int from expenses where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  0,
  'anon cannot read expenses directly'
);

select is(
  (select count(*)::int from business_members where business_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000002'::uuid)),
  0,
  'anon cannot read business_members directly'
);

-- Anon write restrictions (Tests 21-25)
select throws_ok(
  'insert into products (business_id, category_id, name, price) values (''10000000-0000-0000-0000-000000000001'', ''ca000000-0000-0000-0000-000000000001'', ''Anon Product'', 100)',
  '42501',
  null,
  'anon cannot insert products'
);

select throws_ok(
  'insert into expenses (business_id, amount, date, description) values (''10000000-0000-0000-0000-000000000001'', 100, current_date, ''Anon Expense'')',
  '42501',
  null,
  'anon cannot insert expenses'
);

select throws_ok(
  'insert into orders (business_id, order_number, guest_id, service_type, channel, total_amount, requested_date) values (''10000000-0000-0000-0000-000000000001'', 99, ''9a000000-0000-0000-0000-000000000001'', ''pickup'', ''storefront'', 100, current_date)',
  '42501',
  null,
  'anon cannot insert orders directly'
);

select throws_ok(
  'insert into guests (business_id, name, phone) values (''10000000-0000-0000-0000-000000000001'', ''Hacker'', ''+33600000000'')',
  '42501',
  null,
  'anon cannot insert guests directly'
);

select throws_ok(
  'insert into business_members (business_id, user_id, role) values (''10000000-0000-0000-0000-000000000001'', ''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'', ''owner'')',
  '42501',
  null,
  'anon cannot insert business_members'
);

-- Anon order tracking and storefront RPCs (Tests 26-29)
select ok(
  public.get_order_by_tracking_token('token-order-a-1234') is not null,
  'anon can track order via tracking token'
);

select ok(
  not (public.get_order_by_tracking_token('token-order-a-1234')::text like '%Alice%')
  and not (public.get_order_by_tracking_token('token-order-a-1234')::text like '%33612345678%'),
  'tracking token RPC omits guest name and phone'
);

select is(
  public.storefront_order_tracking_token('10000000-0000-0000-0000-000000000001'::uuid, 1, '+33612345678'),
  'token-order-a-1234',
  'anon gets tracking token with matching ticket and phone'
);

select is(
  public.storefront_order_tracking_token('10000000-0000-0000-0000-000000000001'::uuid, 1, '+33699999999'),
  null,
  'storefront_order_tracking_token returns null for mismatched phone'
);

-- ----------------------------------------------------------------------------
-- Section 3: Authenticated Member Tests (Tests 30-49)
-- ----------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Membership helpers verification (Tests 30-32)
select is(
  public.is_business_member('10000000-0000-0000-0000-000000000001'::uuid),
  true,
  'member_a is recognized as member of Biz A'
);

select is(
  public.is_business_member('20000000-0000-0000-0000-000000000002'::uuid),
  false,
  'member_a is not recognized as member of Biz B'
);

select is(
  public.is_business_owner('10000000-0000-0000-0000-000000000001'::uuid),
  true,
  'member_a is recognized as owner of Biz A'
);

-- Tenant read scoping (Tests 33-41)
select is(
  (select count(*)::int from products where business_id = '10000000-0000-0000-0000-000000000001'::uuid),
  2,
  'member_a can read both visible and hidden products of Biz A'
);

select is(
  (select count(*)::int from products where business_id = '20000000-0000-0000-0000-000000000002'::uuid and visible = false),
  0,
  'member_a cannot read hidden products of Biz B'
);

select is(
  (select count(*)::int from guests where business_id = '20000000-0000-0000-0000-000000000002'::uuid),
  0,
  'member_a cannot read guests of Biz B'
);

select is(
  (select count(*)::int from orders where business_id = '20000000-0000-0000-0000-000000000002'::uuid),
  0,
  'member_a cannot read orders of Biz B'
);

select is(
  (select count(*)::int from expenses where business_id = '20000000-0000-0000-0000-000000000002'::uuid),
  0,
  'member_a cannot read expenses of Biz B'
);

select is(
  (select count(*)::int from business_members where business_id = '20000000-0000-0000-0000-000000000002'::uuid),
  0,
  'member_a cannot read members of Biz B'
);

select is(
  (select count(*)::int from business_settings where business_id = '10000000-0000-0000-0000-000000000001'::uuid),
  1,
  'member_a can read full business_settings of Biz A'
);

select is(
  (select low_stock_threshold from business_settings where business_id = '10000000-0000-0000-0000-000000000001'::uuid),
  5,
  'member_a can read private columns like low_stock_threshold of Biz A'
);

select is(
  (select count(*)::int from business_settings where business_id = '20000000-0000-0000-0000-000000000002'::uuid),
  0,
  'member_a cannot read business_settings of Biz B'
);

-- Tenant write scoping & mutation restrictions (Tests 42-49)
select lives_ok(
  'insert into products (business_id, category_id, name, price) values (''10000000-0000-0000-0000-000000000001'', ''ca000000-0000-0000-0000-000000000001'', ''New Member Product'', 500)',
  'member_a can insert product into Biz A'
);

select lives_ok(
  'insert into expenses (business_id, amount, date, description) values (''10000000-0000-0000-0000-000000000001'', 350, current_date, ''Member Expense'')',
  'member_a can insert expense into Biz A'
);

select throws_ok(
  'insert into products (business_id, category_id, name, price) values (''20000000-0000-0000-0000-000000000002'', ''cb000000-0000-0000-0000-000000000002'', ''Hacked Product'', 999)',
  '42501',
  null,
  'member_a cannot insert product into Biz B'
);

select throws_ok(
  'insert into expenses (business_id, amount, date, description) values (''20000000-0000-0000-0000-000000000002'', 999, current_date, ''Hacked Expense'')',
  '42501',
  null,
  'member_a cannot insert expense into Biz B'
);

select throws_ok(
  'insert into businesses (id, name, slug, currency) values (''30000000-0000-0000-0000-000000000003''::uuid, ''Biz C'', ''biz-c'', ''EUR'')',
  '42501',
  null,
  'authenticated user cannot insert businesses'
);

-- Non-member authenticated user cannot insert businesses (#120 / M7)
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';
select throws_ok(
  'insert into businesses (id, name, slug, currency) values (''30000000-0000-0000-0000-000000000003''::uuid, ''Biz C'', ''biz-c'', ''EUR'')',
  '42501',
  null,
  'authenticated non-member cannot insert businesses'
);

-- Restore member_a context
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select throws_ok(
  'insert into orders (business_id, order_number, guest_id, service_type, channel, total_amount, requested_date) values (''10000000-0000-0000-0000-000000000001'', 99, ''9a000000-0000-0000-0000-000000000001'', ''pickup'', ''in-person'', 100, current_date)',
  '42501',
  null,
  'authenticated member cannot insert orders directly'
);

select throws_ok(
  'insert into order_items (order_id, business_id, product_id, product_name, quantity, unit_price, total_price) values (''0a000000-0000-0000-0000-000000000001'', ''10000000-0000-0000-0000-000000000001'', ''da000000-0000-0000-0000-000000000001'', ''Visible Prod A'', 1, 1000, 1000)',
  '42501',
  null,
  'authenticated member cannot insert order_items directly'
);

-- Finish pgTAP suite and rollback seeded data
select * from finish();
rollback;
