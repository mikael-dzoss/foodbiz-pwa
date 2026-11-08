-- ============================================================================
-- Test Suite: realtime_orders.test.sql (#124)
-- Description: pgTAP tests verifying Supabase Realtime publication setup,
--              replica identity full on public.orders, and RLS policy enforcement
--              ensuring real-time postgres_changes are scoped strictly to authenticated
--              business members and never leaked to anon or non-members.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(10);

-- ----------------------------------------------------------------------------
-- Test Seeds and Role Permissions
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

-- 4. Business Members (User A is owner of Biz A; User B is not a member of either)
insert into public.business_members (id, business_id, user_id, role)
values
  ('ba000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner')
on conflict (business_id, user_id) do nothing;

-- 5. Seed Guests and Orders for Biz A and Biz B
insert into public.guests (id, business_id, name, phone)
values
  ('9a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Customer A', '+33600000101'),
  ('9b000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Customer B', '+33600000201')
on conflict (id) do nothing;

insert into public.orders (
  id,
  business_id,
  order_number,
  guest_id,
  tracking_token,
  submitted_name,
  service_type,
  channel,
  status,
  paid,
  payment_preference,
  total_amount,
  requested_date
) values
  (
    '0a000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    101,
    '9a000000-0000-0000-0000-000000000001'::uuid,
    'tk_live_test_biz_a_order',
    'Customer A',
    'pickup',
    'storefront',
    'NEW',
    'unpaid',
    'on_handover',
    2500,
    current_date
  ),
  (
    '0b000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid,
    201,
    '9b000000-0000-0000-0000-000000000002'::uuid,
    'tk_live_test_biz_b_order',
    'Customer B',
    'delivery',
    'storefront',
    'NEW',
    'unpaid',
    'on_handover',
    3500,
    current_date
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Section 1: Publication and Replica Identity Verification (Tests 1-3)
-- ----------------------------------------------------------------------------

-- Test 1: Verify supabase_realtime publication exists
select is(
  (select count(*)::int from pg_publication where pubname = 'supabase_realtime'),
  1,
  'supabase_realtime publication exists in pg_publication'
);

-- Test 2: Verify public.orders is registered in pg_publication_tables under supabase_realtime
select is(
  (select count(*)::int
   from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename = 'orders'),
  1,
  'public.orders is registered in pg_publication_tables under supabase_realtime'
);

-- Test 3: Verify public.orders has REPLICA IDENTITY FULL (relreplident = 'f')
select is(
  (select relreplident::text
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'orders'),
  'f',
  'public.orders has relreplident = ''f'' (REPLICA IDENTITY FULL) in pg_class'
);

-- ----------------------------------------------------------------------------
-- Section 2: Row Level Security Configuration on public.orders (Tests 4-6)
-- ----------------------------------------------------------------------------

-- Test 4: Verify public.orders has RLS enabled (relrowsecurity = true)
select is(
  (select relrowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'orders'),
  true,
  'public.orders has relrowsecurity = true (Row Level Security enabled)'
);

-- Test 5: Verify orders_select_authenticated policy exists for authenticated role
select is(
  (select count(*)::int
   from pg_policies
   where schemaname = 'public'
     and tablename = 'orders'
     and policyname = 'orders_select_authenticated'
     and cmd = 'SELECT'
     and 'authenticated' = any(roles)),
  1,
  'orders_select_authenticated policy exists for authenticated role on public.orders'
);

-- Test 6: Verify anon has no select policy on public.orders
select is(
  (select count(*)::int
   from pg_policies
   where schemaname = 'public'
     and tablename = 'orders'
     and cmd = 'SELECT'
     and ('anon' = any(roles) or 'public' = any(roles))),
  0,
  'anon role has no select policy on public.orders'
);

-- ----------------------------------------------------------------------------
-- Section 3: Realtime RLS Enforcement and Tenant Isolation (Tests 7-10)
-- ----------------------------------------------------------------------------

-- Test 7: Anonymous role cannot select any orders (CDC events are blocked)
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{}';

select is(
  (select count(*)::int from public.orders),
  0,
  'anon role cannot select any orders from public.orders'
);

-- Test 8 & 9: Authenticated Member A sees only Biz A orders (tenant isolation)
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  (select count(*)::int from public.orders where business_id = '10000000-0000-0000-0000-000000000001'::uuid),
  1,
  'authenticated member of Biz A can select Biz A orders'
);

select is(
  (select count(*)::int from public.orders where business_id = '20000000-0000-0000-0000-000000000002'::uuid),
  0,
  'authenticated member of Biz A cannot select Biz B orders'
);

-- Test 10: Authenticated non-member sees no orders
set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select is(
  (select count(*)::int from public.orders),
  0,
  'authenticated non-member cannot select any orders'
);

select * from finish();

rollback;
