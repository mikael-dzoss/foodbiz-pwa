-- ============================================================================
-- Test Suite: public_surface.test.sql
-- Description: pgTAP tests for what `anon` (the public key) can do directly through
--              PostgREST: column-level privacy of products, place_order limits,
--              idempotent replay, database-side rate limiting, order lookup limiting
--              and the explicit tracking payload. Mirrors src/domain/anti-abuse.ts:
--              50 per line, 100 per order, 50 lines, 3 orders / 10 min / phone,
--              120 orders / 10 min / business, 5 failed lookups / 10 min / phone.
--
-- Unlike the other suites, this file does NOT blanket-grant table privileges, so the
-- column grants and revokes made by the migrations are what is under test.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(86);

-- ----------------------------------------------------------------------------
-- Seeds (as the migration role)
-- ----------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1111111-1111-1111-1111-111111111111'::uuid, 'authenticated', 'authenticated', 'ps_member_x@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('a2222222-2222-2222-2222-222222222222'::uuid, 'authenticated', 'authenticated', 'ps_member_y@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.businesses (id, name, slug, currency)
values
  ('b1000000-0000-0000-0000-000000000001'::uuid, 'PS Business X', 'ps-biz-x', 'EUR'),
  ('b2000000-0000-0000-0000-000000000002'::uuid, 'PS Business Y', 'ps-biz-y', 'EUR'),
  ('b3000000-0000-0000-0000-000000000003'::uuid, 'PS Business Z', 'ps-biz-z', 'EUR');

insert into public.business_members (business_id, user_id, role)
values
  ('b1000000-0000-0000-0000-000000000001'::uuid, 'a1111111-1111-1111-1111-111111111111'::uuid, 'owner'),
  ('b2000000-0000-0000-0000-000000000002'::uuid, 'a2222222-2222-2222-2222-222222222222'::uuid, 'owner');

-- Business X: wero is disabled, everything else on.
insert into public.business_settings (business_id, payment_methods)
values
  ('b1000000-0000-0000-0000-000000000001'::uuid, '{"cash": true, "revolut": true, "wero": false}'::jsonb),
  ('b2000000-0000-0000-0000-000000000002'::uuid, '{"cash": true, "revolut": true, "wero": true}'::jsonb),
  ('b3000000-0000-0000-0000-000000000003'::uuid, '{"cash": true, "revolut": true, "wero": true}'::jsonb);

insert into public.product_categories (id, business_id, name)
values
  ('c1000000-0000-0000-0000-000000000001'::uuid, 'b1000000-0000-0000-0000-000000000001'::uuid, 'Cat X'),
  ('c2000000-0000-0000-0000-000000000002'::uuid, 'b2000000-0000-0000-0000-000000000002'::uuid, 'Cat Y'),
  ('c3000000-0000-0000-0000-000000000003'::uuid, 'b3000000-0000-0000-0000-000000000003'::uuid, 'Cat Z');

insert into public.products (id, business_id, category_id, name, price, unit_cost, stock, visible)
values
  ('d1000000-0000-0000-0000-000000000001'::uuid, 'b1000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'X One', 500, 120, 500, true),
  ('d1000000-0000-0000-0000-000000000002'::uuid, 'b1000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'X Two', 300, 90, 500, true),
  ('d1000000-0000-0000-0000-000000000003'::uuid, 'b1000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'X Three', 200, 60, 500, true),
  ('d1000000-0000-0000-0000-000000000004'::uuid, 'b1000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'X Hidden', 900, 50, 5, false),
  ('d2000000-0000-0000-0000-000000000001'::uuid, 'b2000000-0000-0000-0000-000000000002'::uuid, 'c2000000-0000-0000-0000-000000000002'::uuid, 'Y One', 400, 77, 5, true),
  ('d3000000-0000-0000-0000-000000000001'::uuid, 'b3000000-0000-0000-0000-000000000003'::uuid, 'c3000000-0000-0000-0000-000000000003'::uuid, 'Z One', 100, 10, 1000, true);

-- ----------------------------------------------------------------------------
-- Section A: anon cannot read unit_cost (products column privileges)
-- ----------------------------------------------------------------------------
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_ok(
  'select unit_cost from public.products',
  '42501',
  null,
  'anon cannot select products.unit_cost'
);

select throws_ok(
  'select * from public.products',
  '42501',
  null,
  'anon cannot select * from products (would include unit_cost)'
);

select throws_ok(
  'select created_at from public.products',
  '42501',
  null,
  'anon cannot select products.created_at'
);

select throws_ok(
  'select c.id, p.unit_cost from public.product_categories c join public.products p on p.category_id = c.id',
  '42501',
  null,
  'anon cannot reach unit_cost through a join from product_categories (embedding-style read)'
);

select lives_ok(
  'select id, business_id, category_id, name, description, price, stock, visible, suggest_add_ons, allergens, image_url from public.products',
  'anon can select every granted product column (PUBLIC_PRODUCT_COLUMNS)'
);

create temp table t_anon_visible_x on commit drop as
select count(*)::int as n from public.products where business_id = 'b1000000-0000-0000-0000-000000000001'::uuid;
grant select on t_anon_visible_x to public;

reset role;

select is(
  (select n from t_anon_visible_x),
  3,
  'anon sees only the 3 visible products of business X (hidden product filtered by RLS)'
);

select is(
  (select array_agg(column_name::text order by column_name)
   from information_schema.column_privileges
   where grantee = 'anon' and table_schema = 'public' and table_name = 'products' and privilege_type = 'SELECT'),
  array['allergens', 'business_id', 'category_id', 'description', 'id', 'image_url', 'name', 'price', 'stock', 'suggest_add_ons', 'visible']::text[],
  'anon has SELECT on exactly the PUBLIC_PRODUCT_COLUMNS of products'
);

-- ----------------------------------------------------------------------------
-- Section B: authenticated users and unit_cost
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claim.sub" = 'a2222222-2222-2222-2222-222222222222';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub": "a2222222-2222-2222-2222-222222222222", "role": "authenticated"}';

create temp table t_nonmember_x on commit drop as
select count(*)::int as n from public.products where business_id = 'b1000000-0000-0000-0000-000000000001'::uuid;
grant select on t_nonmember_x to public;

create temp table t_member_y_own on commit drop as
select max(unit_cost)::int as cost from public.products where business_id = 'b2000000-0000-0000-0000-000000000002'::uuid;
grant select on t_member_y_own to public;

reset role;

select is(
  (select n from t_nonmember_x),
  0,
  'an authenticated non-member cannot read another tenant''s visible products (and so not their unit_cost)'
);

select is(
  (select cost from t_member_y_own),
  77,
  'a member still reads unit_cost of their own business'
);

set local role authenticated;
set local "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub": "a1111111-1111-1111-1111-111111111111", "role": "authenticated"}';

create temp table t_member_x_hidden on commit drop as
select count(*)::int as n from public.products where business_id = 'b1000000-0000-0000-0000-000000000001'::uuid and visible = false;
grant select on t_member_x_hidden to public;

create temp table t_member_x_other on commit drop as
select count(*)::int as n from public.products where business_id = 'b2000000-0000-0000-0000-000000000002'::uuid;
grant select on t_member_x_other to public;

reset role;

select is((select n from t_member_x_hidden), 1, 'a member still reads hidden products of their own business');
select is((select n from t_member_x_other), 0, 'a member cannot read products (unit_cost) of another business');

-- ----------------------------------------------------------------------------
-- Section C: rate_limit_attempts is closed to API roles
-- ----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.rate_limit_attempts'::regclass),
  'rate_limit_attempts has RLS enabled'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'rate_limit_attempts'),
  0,
  'rate_limit_attempts has no policies (default deny)'
);

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_ok('select * from public.rate_limit_attempts', '42501', null, 'anon cannot read rate_limit_attempts');
select throws_ok(
  $$insert into public.rate_limit_attempts (bucket, key_hash) values ('order_phone', repeat('a', 64))$$,
  '42501', null, 'anon cannot write rate_limit_attempts'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub": "a1111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok('select * from public.rate_limit_attempts', '42501', null, 'authenticated cannot read rate_limit_attempts');
select throws_ok(
  $$insert into public.rate_limit_attempts (bucket, key_hash) values ('order_phone', repeat('a', 64))$$,
  '42501', null, 'authenticated cannot write rate_limit_attempts'
);

reset role;

select ok(
  not has_function_privilege('anon', 'public.rate_limit_is_exceeded(text, text, integer, interval, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.rate_limit_is_exceeded(text, text, integer, interval, boolean)', 'execute')
  and not has_function_privilege('service_role', 'public.rate_limit_is_exceeded(text, text, integer, interval, boolean)', 'execute'),
  'rate_limit_is_exceeded is not callable through the API'
);

select ok(
  not has_function_privilege('anon', 'public.rate_limit_key(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.rate_limit_key(uuid, text)', 'execute')
  and not has_function_privilege('service_role', 'public.rate_limit_key(uuid, text)', 'execute'),
  'rate_limit_key is not callable through the API'
);

select ok(
  not has_table_privilege('service_role', 'public.rate_limit_attempts', 'select,insert,update,delete,truncate,references,trigger'),
  'service_role has no privilege on rate_limit_attempts'
);

select ok(
  not has_function_privilege('anon', 'public.rate_limit_record(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.rate_limit_record(text, text)', 'execute')
  and not has_function_privilege('service_role', 'public.rate_limit_record(text, text)', 'execute'),
  'rate_limit_record is not callable through the API'
);

-- ----------------------------------------------------------------------------
-- Section D: place_order limits (anon, storefront channel)
-- Every rejected call uses its own phone; rejected calls never record an attempt.
-- ----------------------------------------------------------------------------
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 51}]'::jsonb)$$,
  'MAX_LINE_QUANTITY_EXCEEDED%',
  'quantity 51 on one line is rejected (max 50)'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 30}, {"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 30}]'::jsonb)$$,
  'MAX_LINE_QUANTITY_EXCEEDED%',
  'duplicate lines of one product are merged before the per-line cap'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 50}, {"product_id": "d1000000-0000-0000-0000-000000000002", "quantity": 50}, {"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb)$$,
  'MAX_ORDER_QUANTITY_EXCEEDED%',
  'total quantity 101 is rejected (max 100 per order)'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    (select jsonb_agg(jsonb_build_object('product_id', 'd1000000-0000-0000-0000-000000000001', 'quantity', 1)) from generate_series(1, 51)))$$,
  'MAX_LINES_EXCEEDED%',
  '51 lines are rejected (max 50)'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'delivery', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
    null, 'on_handover', repeat('a', 301))$$,
  'INVALID_DELIVERY_ADDRESS%',
  'a 301-character delivery address is rejected (max 300)'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
    null, 'on_handover', null, repeat('n', 501))$$,
  'INVALID_NOTES%',
  'notes over 500 characters are rejected'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
    null, 'wero')$$,
  'INVALID_PAYMENT_PREFERENCE%',
  'a payment preference the business disabled (wero) is rejected'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date + 31,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'SLOT_INVALID: date_out_of_window',
  'a requested date more than 30 days ahead is rejected'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date - 2,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'SLOT_INVALID: date_out_of_window',
  'a requested date in the past is rejected'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb,
    '10:00:30')$$,
  'INVALID_REQUESTED_TIME%',
  'a requested time with seconds is rejected'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', 'not-a-phone',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'INVALID_GUEST_PHONE%',
  'a phone that is not E.164 is rejected'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000001',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": "1.5"}]'::jsonb)$$,
  'INVALID_ITEM_QUANTITY%',
  'a fractional quantity is rejected'
);

-- At the limits everything is accepted: 50 on a line, 30 days ahead, whole-minute time, cash.
create temp table t_at_limit on commit drop as
select public.place_order(
  'b1000000-0000-0000-0000-000000000001'::uuid, 'Limit Tester', '+33699000002',
  'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date + 30,
  '[{"product_id": "d1000000-0000-0000-0000-000000000001", "quantity": 50}]'::jsonb,
  '10:30', 'on_handover'
) as res;
grant select on t_at_limit to public;

reset role;

select is(
  (select (res->>'total_amount')::int from t_at_limit),
  25000,
  'an order exactly at the limits (50 units, +30 days) is accepted'
);

select is(
  (select stock from public.products where id = 'd1000000-0000-0000-0000-000000000001'::uuid),
  450,
  'only the accepted order decremented stock (rejected calls rolled back)'
);

select is(
  (select count(*)::int from public.orders where business_id = 'b1000000-0000-0000-0000-000000000001'::uuid),
  1,
  'rejected calls created no orders'
);

-- ----------------------------------------------------------------------------
-- Section E: idempotency
-- ----------------------------------------------------------------------------
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

create temp table t_idem_1 on commit drop as
select public.place_order(
  'b1000000-0000-0000-0000-000000000001'::uuid, 'Idem Buyer', '+33699000003',
  'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
  '[{"product_id": "d1000000-0000-0000-0000-000000000002", "quantity": 2}]'::jsonb,
  null, 'on_handover', null, null, false,
  'f0000000-0000-4000-8000-000000000001'::uuid
) as res;
grant select on t_idem_1 to public;

create temp table t_idem_2 on commit drop as
select public.place_order(
  'b1000000-0000-0000-0000-000000000001'::uuid, 'Idem Buyer', '+33699000003',
  'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
  '[{"product_id": "d1000000-0000-0000-0000-000000000002", "quantity": 2}]'::jsonb,
  null, 'on_handover', null, null, false,
  'f0000000-0000-4000-8000-000000000001'::uuid
) as res;
grant select on t_idem_2 to public;

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Someone Else', '+33699000004',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000002", "quantity": 2}]'::jsonb,
    null, 'on_handover', null, null, false, 'f0000000-0000-4000-8000-000000000001'::uuid)$$,
  'INVALID_IDEMPOTENCY_KEY%',
  'an idempotency key cannot be replayed with a different phone'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Idem Buyer', '+33699000003',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
    '[{"product_id": "d1000000-0000-0000-0000-000000000002", "quantity": 3}]'::jsonb,
    null, 'on_handover', null, null, false, 'f0000000-0000-4000-8000-000000000001'::uuid)$$,
  'INVALID_IDEMPOTENCY_KEY%',
  'an idempotency key cannot be replayed with a different cart (quantity)'
);

reset role;

select is(
  (select res - 'replayed' from t_idem_2),
  (select res - 'replayed' from t_idem_1),
  'the same idempotency key returns the original order result'
);

select is(
  (select array[(res->>'replayed'), (select res->>'replayed' from t_idem_2)] from t_idem_1),
  array['false', 'true'],
  'only the repeated call is flagged as replayed'
);

select is(
  (select count(*)::int from public.orders where idempotency_key = 'f0000000-0000-4000-8000-000000000001'::uuid),
  1,
  'the same idempotency key yields exactly one order'
);

select is(
  (select stock from public.products where id = 'd1000000-0000-0000-0000-000000000002'::uuid),
  498,
  'the replay did not decrement stock a second time'
);

select is(
  (select count(*)::int from public.rate_limit_attempts
   where bucket = 'order_phone' and key_hash = public.rate_limit_key('b1000000-0000-0000-0000-000000000001'::uuid, '+33699000003')),
  1,
  'the replay did not consume rate-limit allowance'
);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'place_order'),
  1,
  'only one place_order overload exists (the unguarded 12-argument version is gone)'
);

select is(
  (select array_agg(a.grantee::regrole::text order by a.grantee::regrole::text)
   from pg_proc p, aclexplode(p.proacl) a
   where p.proname = 'place_order' and p.pronamespace = 'public'::regnamespace
     and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner),
  array['anon', 'authenticated', 'service_role']::text[],
  'place_order is executable by exactly anon, authenticated and service_role (besides its owner)'
);

select is(
  (select count(*)::int
   from pg_proc p, aclexplode(p.proacl) a
   where p.proname = 'place_order' and p.pronamespace = 'public'::regnamespace and a.grantee = 0),
  0,
  'place_order is not executable by PUBLIC'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_orders_business_idempotency_key'
          and indexdef ilike '%unique%' and indexdef ilike '%(business_id, idempotency_key)%'),
  'a unique index on (business_id, idempotency_key) exists'
);

-- ----------------------------------------------------------------------------
-- Section F: per-phone rate limit (3 orders / 10 minutes), hashed keys, pruning
-- ----------------------------------------------------------------------------
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select lives_ok(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Rate Buyer', '+33699000005',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb);
    select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Rate Buyer', '+33699000005',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb);
    select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Rate Buyer', '+33699000005',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb)$$,
  'three orders from one phone within the window are accepted'
);

select throws_like(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Rate Buyer', '+33699000005',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb)$$,
  'RATE_LIMITED%',
  'the fourth order from the same phone raises RATE_LIMITED'
);

reset role;

select is(
  (select count(*)::int from public.orders o join public.guests g on g.id = o.guest_id
   where g.phone = '+33699000005' and o.business_id = 'b1000000-0000-0000-0000-000000000001'::uuid),
  3,
  'the rate-limited call created no order'
);

select is(
  (select stock from public.products where id = 'd1000000-0000-0000-0000-000000000003'::uuid),
  497,
  'the rate-limited call did not touch stock'
);

select is(
  (select count(*)::int from public.rate_limit_attempts
   where bucket = 'order_phone' and key_hash = public.rate_limit_key('b1000000-0000-0000-0000-000000000001'::uuid, '+33699000005')),
  3,
  'attempts are keyed by the SHA-256 hash of (business, phone)'
);

select is(
  (select count(*)::int from public.rate_limit_attempts where key_hash !~ '^[0-9a-f]{64}$' or key_hash like '%+33%'),
  0,
  'no raw phone number is stored in rate_limit_attempts'
);

-- A business member (dashboard staff) is not rate limited as a visitor.
set local role authenticated;
set local "request.jwt.claim.sub" = 'a1111111-1111-1111-1111-111111111111';
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claims" = '{"sub": "a1111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Rate Buyer', '+33699000005',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb)$$,
  'a business member is exempt from the visitor rate limit'
);

reset role;

-- Pruning: an expired row is deleted opportunistically by the next limited call.
insert into public.rate_limit_attempts (bucket, key_hash, created_at)
values ('order_phone', repeat('b', 64), now() - interval '1 hour'),
       ('order_phone', repeat('c', 64), now());

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select lives_ok(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Prune Buyer', '+33699000006',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb)$$,
  'an order from a fresh phone is accepted'
);

reset role;

select is(
  (select count(*)::int from public.rate_limit_attempts where key_hash = repeat('b', 64)),
  0,
  'an attempt older than the window is pruned'
);

select is(
  (select count(*)::int from public.rate_limit_attempts where key_hash = repeat('c', 64)),
  1,
  'a recent attempt is kept'
);

-- A prune deletes at most 500 expired rows per call: 600 expired rows -> 100 left.
insert into public.rate_limit_attempts (bucket, key_hash, created_at)
select 'order_phone', repeat('d', 64), now() - interval '2 hours' from generate_series(1, 600);

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select lives_ok(
  $$select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Prune Buyer', '+33699000010',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb)$$,
  'an order from another fresh phone is accepted'
);

reset role;

select is(
  (select count(*)::int from public.rate_limit_attempts where key_hash = repeat('d', 64)),
  100,
  'a single prune is bounded to 500 expired rows'
);

-- ----------------------------------------------------------------------------
-- Section G: per-business flood brake (120 orders / 10 minutes), business Z
-- ----------------------------------------------------------------------------
insert into public.rate_limit_attempts (bucket, key_hash)
select 'order_business', public.rate_limit_key('b3000000-0000-0000-0000-000000000003'::uuid, '')
from generate_series(1, 120);

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_like(
  $$select public.place_order('b3000000-0000-0000-0000-000000000003'::uuid, 'Flood Buyer', '+33699000007',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d3000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'RATE_LIMITED%',
  'the business-wide ceiling (120 / 10 min) raises RATE_LIMITED for any phone'
);

reset role;

select is(
  (select count(*)::int from public.orders where business_id = 'b3000000-0000-0000-0000-000000000003'::uuid),
  0,
  'the flood-braked call created no order'
);

delete from public.rate_limit_attempts where bucket = 'order_business';
insert into public.rate_limit_attempts (bucket, key_hash)
select 'order_business', public.rate_limit_key('b3000000-0000-0000-0000-000000000003'::uuid, '')
from generate_series(1, 119);

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select lives_ok(
  $$select public.place_order('b3000000-0000-0000-0000-000000000003'::uuid, 'Flood Buyer', '+33699000007',
    'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date, '[{"product_id": "d3000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'one below the ceiling (119 recorded) still accepts an order'
);

reset role;

-- ----------------------------------------------------------------------------
-- Section H: order lookup limiting (5 failed lookups / 10 minutes / phone)
-- ----------------------------------------------------------------------------
select is(
  (select count(*)::int from public.rate_limit_attempts
   where bucket = 'lookup_phone' and key_hash = public.rate_limit_key('b1000000-0000-0000-0000-000000000001'::uuid, '+33699000002')),
  0,
  'precondition: no lookup attempts recorded yet for this key'
);

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

create temp table t_lookup_hit on commit drop as
select public.storefront_order_tracking_token(
  'b1000000-0000-0000-0000-000000000001'::uuid, 1, '+33699000002'
) as token;
grant select on t_lookup_hit to public;

create temp table t_lookup_misses on commit drop as
select public.storefront_order_tracking_token(
  'b1000000-0000-0000-0000-000000000001'::uuid, 9000 + i, '+33699000002'
) as token
from generate_series(1, 5) as i;
grant select on t_lookup_misses to public;

reset role;

select ok(
  (select token is not null from t_lookup_hit),
  'a correct lookup returns the tracking token'
);

select is(
  (select count(*)::int from t_lookup_misses where token is null),
  5,
  'five wrong order numbers return no token'
);

select is(
  (select count(*)::int from public.rate_limit_attempts
   where bucket = 'lookup_phone' and key_hash = public.rate_limit_key('b1000000-0000-0000-0000-000000000001'::uuid, '+33699000002')),
  5,
  'only the failed lookups were recorded, under a hashed key'
);

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_like(
  $$select public.storefront_order_tracking_token('b1000000-0000-0000-0000-000000000001'::uuid, 9999, '+33699000002')$$,
  'RATE_LIMITED%',
  'the sixth failed lookup for a phone raises RATE_LIMITED'
);

select throws_like(
  $$select public.storefront_order_tracking_token('b1000000-0000-0000-0000-000000000001'::uuid, 1, '+33699000002')$$,
  'RATE_LIMITED%',
  'a limited phone gets RATE_LIMITED even for a correct order number (no oracle)'
);

create temp table t_lookup_other on commit drop as
select public.storefront_order_tracking_token(
  'b1000000-0000-0000-0000-000000000001'::uuid, 9999, '+33699000008'
) as token;
grant select on t_lookup_other to public;

reset role;

select ok(
  (select token is null from t_lookup_other),
  'another phone is not affected by the limit'
);

-- A correct lookup is not blocked while the failed-lookup count is below the limit (4 of 5).
set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

create temp table t_below_order on commit drop as
select public.place_order('b1000000-0000-0000-0000-000000000001'::uuid, 'Below Limit', '+33699000011',
  'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
  '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb) as res;
grant select on t_below_order to public;

create temp table t_below_misses on commit drop as
select public.storefront_order_tracking_token(
  'b1000000-0000-0000-0000-000000000001'::uuid, 8000 + i, '+33699000011'
) as token
from generate_series(1, 4) as i;
grant select on t_below_misses to public;

create temp table t_below_hit on commit drop as
select public.storefront_order_tracking_token(
  'b1000000-0000-0000-0000-000000000001'::uuid, (res->>'order_number')::int, '+33699000011'
) as token
from t_below_order;
grant select on t_below_hit to public;

reset role;

select is(
  (select token from t_below_hit),
  (select res->>'tracking_token' from t_below_order),
  'a correct lookup still succeeds after 4 failed lookups (below the limit of 5)'
);

-- Per-business ceiling on failed lookups (300 / 10 min): varying the phone cannot bypass it.
insert into public.rate_limit_attempts (bucket, key_hash)
select 'lookup_business', public.rate_limit_key('b3000000-0000-0000-0000-000000000003'::uuid, '')
from generate_series(1, 300);

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_like(
  $$select public.storefront_order_tracking_token('b3000000-0000-0000-0000-000000000003'::uuid, 1, '+33699000012')$$,
  'RATE_LIMITED%',
  'the per-business failed-lookup ceiling raises RATE_LIMITED for any phone'
);

reset role;

-- ----------------------------------------------------------------------------
-- Section I: get_order_by_tracking_token exposes only the explicit keys
-- ----------------------------------------------------------------------------
update public.businesses set address = '9 Rue du Four, 75006 Paris' where id = 'b1000000-0000-0000-0000-000000000001';
insert into public.pickup_locations (id, business_id, name, address, postcode)
values ('f1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Gare du Nord', '18 Rue de Dunkerque', '75010');

set local role anon;
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claims" = '{"role": "anon"}';

create temp table t_tracking on commit drop as
select public.get_order_by_tracking_token((select res->>'tracking_token' from t_at_limit)) as res;
grant select on t_tracking to public;

create temp table t_delivery_order on commit drop as
select public.place_order(
  'b1000000-0000-0000-0000-000000000001'::uuid, 'Delivery Buyer', '+33699000013',
  'delivery', 'storefront', (now() at time zone 'Europe/Paris')::date,
  '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb,
  null, 'on_handover', '12 Rue de Rivoli, 75001 Paris', 'Door code 4589'
) as res;
grant select on t_delivery_order to public;

create temp table t_tracking_delivery on commit drop as
select public.get_order_by_tracking_token((select res->>'tracking_token' from t_delivery_order)) as res;
grant select on t_tracking_delivery to public;

create temp table t_pickup_with_address on commit drop as
select public.place_order(
  'b1000000-0000-0000-0000-000000000001'::uuid, 'Pickup Buyer', '+33699000014',
  'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
  '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb,
  null, 'on_handover', 'Should stay hidden on pickup', null
) as res;
grant select on t_pickup_with_address to public;

create temp table t_relay_order on commit drop as
select public.place_order(
  'b1000000-0000-0000-0000-000000000001'::uuid, 'Relay Buyer', '+33699000015',
  'pickup', 'storefront', (now() at time zone 'Europe/Paris')::date,
  '[{"product_id": "d1000000-0000-0000-0000-000000000003", "quantity": 1}]'::jsonb,
  p_pickup_location_id := 'f1000000-0000-0000-0000-000000000001'
) as res;
grant select on t_relay_order to public;

create temp table t_tracking_relay on commit drop as
select public.get_order_by_tracking_token((select res->>'tracking_token' from t_relay_order)) as res;
grant select on t_tracking_relay to public;

create temp table t_tracking_pickup_addr on commit drop as
select public.get_order_by_tracking_token((select res->>'tracking_token' from t_pickup_with_address)) as res;
grant select on t_tracking_pickup_addr to public;

reset role;

select is(
  (select array_agg(k order by k) from jsonb_object_keys((select res from t_tracking)) k),
  array['items', 'order']::text[],
  'tracking payload has exactly the keys items and order'
);

select is(
  (select array_agg(k order by k) from jsonb_object_keys((select res->'order' from t_tracking)) k),
  array[
    'business_id',
    'cancellation_reason',
    'created_at',
    'delivery_address',
    'id',
    'order_number',
    'paid',
    'payment_preference',
    'pickup_location_address',
    'pickup_location_name',
    'requested_date',
    'requested_time',
    'service_type',
    'status',
    'total_amount',
    'tracking_token',
    'updated_at'
  ]::text[],
  'tracking order exposes exactly the explicit allowlisted keys (including delivery_address and the pickup location)'
);

select is(
  (select array_agg(k order by k) from jsonb_object_keys((select res->'items'->0 from t_tracking)) k),
  array['product_name', 'quantity', 'total_price', 'unit_price']::text[],
  'tracking items expose exactly product_name, quantity, unit_price, total_price'
);

select is(
  (select res->'order'->>'delivery_address' from t_tracking_delivery),
  '12 Rue de Rivoli, 75001 Paris',
  'delivery order tracking returns the delivery address'
);

select ok(
  not ((select res::text from t_tracking_delivery) like '%Door code 4589%'),
  'delivery order tracking still omits order notes'
);

select is(
  (select res->'order'->>'delivery_address' from t_tracking_pickup_addr),
  null::text,
  'pickup order tracking returns null for delivery_address even if stored on the row'
);

select is(
  (select res->'order'->>'pickup_location_name' from t_tracking_relay),
  'Gare du Nord',
  'relay order tracking returns the pickup location name'
);

select is(
  (select res->'order'->>'pickup_location_address' from t_tracking_relay),
  '18 Rue de Dunkerque, 75010',
  'relay order tracking returns the pickup location address and postcode'
);

select ok(
  (select (res->'order'->'pickup_location_name') = 'null'::jsonb
      and res->'order'->>'pickup_location_address' = '9 Rue du Four, 75006 Paris'
   from t_tracking_pickup_addr),
  'shop pickup tracking returns no location name and the shop address'
);

select ok(
  (select (res->'order'->'pickup_location_name') = 'null'::jsonb
      and (res->'order'->'pickup_location_address') = 'null'::jsonb
   from t_tracking_delivery),
  'delivery order tracking returns no pickup location'
);

select ok(
  has_function_privilege('anon', 'public.get_order_by_tracking_token(text)', 'execute')
  and has_function_privilege('authenticated', 'public.get_order_by_tracking_token(text)', 'execute')
  and has_function_privilege('service_role', 'public.get_order_by_tracking_token(text)', 'execute')
  and not has_function_privilege('public', 'public.get_order_by_tracking_token(text)', 'execute'),
  'get_order_by_tracking_token grants execute only to anon, authenticated and service_role'
);

-- ----------------------------------------------------------------------------
-- Section J: hygiene
-- ----------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
      and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
  ),
  'set_updated_at pins its search_path'
);

select is(
  (select count(*)::int from pg_indexes where schemaname = 'public' and indexname = 'idx_orders_tracking_token'),
  0,
  'the redundant idx_orders_tracking_token is gone (orders_tracking_token_unique remains)'
);

select is(
  (select count(*)::int
   from pg_class c join pg_index i on i.indexrelid = c.oid
   where c.relnamespace = 'public'::regnamespace
     and c.relname in ('idx_products_category_id', 'idx_orders_guest_id', 'idx_order_items_product_id',
                       'idx_orders_business_idempotency_key')
     and i.indisvalid and i.indisready),
  4,
  'the FK-leading indexes and the idempotency unique index exist and are valid (not left INVALID by a failed concurrent build)'
);

-- No function callable by anon (or PUBLIC) may return or reference unit_cost. There is no
-- legitimate exception today: add one here explicitly, with a reason, if that ever changes.
select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and has_function_privilege('anon', p.oid, 'execute')
     and (p.prosrc ilike '%unit_cost%' or pg_get_function_result(p.oid) ilike '%unit_cost%')),
  null::text[],
  'no function executable by anon/PUBLIC references or returns unit_cost'
);

select * from finish();
rollback;
