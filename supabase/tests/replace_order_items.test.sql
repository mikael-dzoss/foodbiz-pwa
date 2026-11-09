-- ============================================================================
-- Test Suite: replace_order_items.test.sql (#122 / M12)
-- Description: pgTAP tests verifying atomic order items replacement,
--              authorization checks for anon, non-member, member, and service_role.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(7);

-- Ensure table grants for standard Supabase API roles
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant temp on database postgres to anon, authenticated, service_role;

-- Auth users
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

-- Businesses
insert into public.businesses (id, name, slug, currency)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Business A', 'biz-a', 'EUR'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Business B', 'biz-b', 'EUR')
on conflict (id) do nothing;

-- Business Members
insert into public.business_members (id, business_id, user_id, role)
values
  ('ba000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'manager')
on conflict (id) do nothing;

-- Categories
insert into public.product_categories (id, business_id, name, sort_order)
values
  ('ca000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Breads', 1)
on conflict (id) do nothing;

-- Products
insert into public.products (id, business_id, category_id, name, price, stock, visible)
values
  ('da000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Croissant', 500, 10, true),
  ('da000000-0000-0000-0000-000000000002'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Baguette', 300, 20, true)
on conflict (id) do nothing;

-- Guest & Order
insert into public.guests (id, business_id, name, phone)
values
  ('fa000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Alice Martin', '+33612345678')
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
  payment_preference,
  requested_date,
  total_amount
) values (
  '0a000000-0000-0000-0000-000000000099'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  101,
  'fa000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'storefront',
  'NEW',
  'unpaid',
  'on_handover',
  '2026-10-15',
  500
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
  '1a000000-0000-0000-0000-000000000099'::uuid,
  '0a000000-0000-0000-0000-000000000099'::uuid,
  '10000000-0000-0000-0000-000000000001'::uuid,
  'da000000-0000-0000-0000-000000000001'::uuid,
  'Croissant',
  1,
  500,
  500
) on conflict (id) do nothing;

-- Test 1: Direct call by anon fails with 42501
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_ok(
  $$select public.replace_order_items(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '0a000000-0000-0000-0000-000000000099'::uuid,
    '[]'::jsonb
  )$$,
  '42501',
  null,
  'replace_order_items direct call by anon fails with 42501'
);

-- Test 2: Direct call by authenticated non-member fails with 42501
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  $$select public.replace_order_items(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '0a000000-0000-0000-0000-000000000099'::uuid,
    '[]'::jsonb
  )$$,
  '42501',
  null,
  'replace_order_items direct call by authenticated non-member fails with 42501'
);

-- Switch to member of Business A
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Test 3: Non-existent order throws P0002
select throws_ok(
  $$select public.replace_order_items(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '99999999-9999-9999-9999-999999999999'::uuid,
    '[]'::jsonb
  )$$,
  'P0002',
  null,
  'replace_order_items with non-existent order throws P0002'
);

-- Test 4: Member succeeds in atomically replacing order items
select lives_ok(
  $$select public.replace_order_items(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '0a000000-0000-0000-0000-000000000099'::uuid,
    '[
      {
        "product_id": "da000000-0000-0000-0000-000000000002",
        "product_name": "Baguette",
        "quantity": 3,
        "unit_price": 300,
        "total_price": 900
      }
    ]'::jsonb
  )$$,
  'replace_order_items succeeds for business member'
);

-- Test 5: Verify old item was removed and new item exists
select is(
  (select count(*)::integer from public.order_items where order_id = '0a000000-0000-0000-0000-000000000099'::uuid),
  1,
  'order has exactly 1 replaced item'
);

select is(
  (select product_name from public.order_items where order_id = '0a000000-0000-0000-0000-000000000099'::uuid limit 1),
  'Baguette',
  'replaced item is Baguette'
);

-- Test 6: service_role can call replace_order_items
set local role service_role;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'service_role';
set local "request.jwt.claims" = '{"role": "service_role"}';

select lives_ok(
  $$select public.replace_order_items(
    '10000000-0000-0000-0000-000000000001'::uuid,
    '0a000000-0000-0000-0000-000000000099'::uuid,
    '[]'::jsonb
  )$$,
  'replace_order_items succeeds for service_role'
);

select * from finish();

rollback;
