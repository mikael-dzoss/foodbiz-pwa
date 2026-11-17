-- ============================================================================
-- Test Suite: owner_only.test.sql
-- Description: owner-only sensitive actions. Payment identifiers and payment-method settings,
--              the business slug and every hard delete (orders, expenses, guests, products)
--              are refused to manager and staff and allowed to the owner; nobody can delete
--              the business_settings row through the API; everything else stays open to
--              every member; service_role and direct connections are exempt.
-- Deliberately does NOT re-grant table privileges (the migrations' privileges are under test).
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(48);

-- ----------------------------------------------------------------------------
-- Seed (as the table owner)
-- ----------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner_a@example.com', '', now(), '{}', '{}', now(), now()),
  ('a2000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'manager_a@example.com', '', now(), '{}', '{}', now(), now()),
  ('a3000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'staff_a@example.com', '', now(), '{}', '{}', now(), now()),
  ('b1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'owner_b@example.com', '', now(), '{}', '{}', now(), now());

insert into public.businesses (id, name, slug, currency)
values
  ('10000000-0000-0000-0000-000000000001', 'Business A', 'oo-biz-a', 'EUR'),
  ('20000000-0000-0000-0000-000000000002', 'Business B', 'oo-biz-b', 'EUR');

insert into public.business_settings (business_id, revolut_revtag, wero_identifier, delivery_fee)
values
  ('10000000-0000-0000-0000-000000000001', '@original', 'original-wero', 100),
  ('20000000-0000-0000-0000-000000000002', '', '', 0);

insert into public.business_members (business_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'manager'),
  ('10000000-0000-0000-0000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'staff'),
  ('20000000-0000-0000-0000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'owner');

insert into public.product_categories (id, business_id, name)
values ('ca000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Breads');

insert into public.guests (id, business_id, name, phone)
values ('9a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alice Martin', '+33612345678');

-- One deletable row of each kind per actor
insert into public.products (business_id, category_id, name, price, stock)
select '10000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'del-' || w, 100, 1
from unnest(array['staff', 'manager', 'owner', 'outsider']) as w;

insert into public.guests (business_id, name)
select '10000000-0000-0000-0000-000000000001', 'del-' || w from unnest(array['staff', 'manager', 'owner', 'outsider']) as w;

insert into public.expenses (business_id, amount, date, description)
select '10000000-0000-0000-0000-000000000001', 100, current_date, 'del-' || w from unnest(array['staff', 'manager', 'owner', 'outsider']) as w;

insert into public.orders (business_id, order_number, guest_id, service_type, channel, requested_date, total_amount, notes)
select '10000000-0000-0000-0000-000000000001', 100 + row_number() over (), '9a000000-0000-0000-0000-000000000001', 'pickup', 'phone', current_date, 100, 'del-' || w
from unnest(array['staff', 'manager', 'owner', 'outsider']) as w;

-- Helpers (rolled back with the transaction)
create function public.__protected_updates(p_who text, p_allowed boolean)
returns setof text
language plpgsql
as $$
declare
  v_col text;
  v_val text;
  v_sql text;
begin
  for v_col, v_val in
    select * from (values
      ('revolut_revtag', $q$'@new'$q$),
      ('wero_identifier', $q$'new-wero'$q$),
      ('payment_methods', $q$'{"cash": true, "revolut": false, "wero": false}'::jsonb$q$),
      ('payment_instructions_en', $q$'EN new'$q$),
      ('payment_instructions_fr', $q$'FR new'$q$)
    ) as v(c, x)
  loop
    v_sql := format('update public.business_settings set %I = %s where business_id = %L',
                    v_col, v_val, '10000000-0000-0000-0000-000000000001');
    if p_allowed then
      return next lives_ok(v_sql, format('%s can change business_settings.%s', p_who, v_col));
    else
      return next throws_ok(v_sql, '42501', null, format('%s cannot change business_settings.%s', p_who, v_col));
    end if;
  end loop;
end;
$$;

create function public.__deletes(p_who text, p_tag text, p_allowed boolean)
returns setof text
language plpgsql
as $$
declare
  v_table text;
  v_col text;
  v_count integer;
begin
  for v_table, v_col in
    select * from (values ('orders', 'notes'), ('expenses', 'description'), ('guests', 'name'), ('products', 'name')) as v(t, c)
  loop
    execute format('delete from public.%I where %I = %L', v_table, v_col, 'del-' || p_tag);
    execute format('select count(*) from public.%I where %I = %L', v_table, v_col, 'del-' || p_tag) into v_count;
    if p_allowed then
      return next is(v_count, 0, format('%s can hard-delete from %s', p_who, v_table));
    else
      return next is(v_count, 1, format('%s cannot hard-delete from %s', p_who, v_table));
    end if;
  end loop;
end;
$$;

grant execute on function public.__protected_updates(text, boolean) to authenticated;
grant execute on function public.__deletes(text, text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Staff
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a3000000-0000-4000-8000-000000000003", "role": "authenticated"}';

select * from public.__protected_updates('staff', false);
select throws_like(
  $$update public.business_settings set revolut_revtag = '@x' where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'OWNER_REQUIRED%', 'the refusal is reported as OWNER_REQUIRED');
select throws_ok(
  $$update public.businesses set slug = 'staff-slug' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'staff cannot change the business slug');
select lives_ok(
  $$update public.businesses set name = 'Renamed by staff' where id = '10000000-0000-0000-0000-000000000001'$$,
  'staff can still change the business name');
select lives_ok(
  $$update public.business_settings set delivery_fee = 150 where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'staff can still change non-payment settings');
select lives_ok(
  $$update public.business_settings set revolut_revtag = revolut_revtag where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'writing a protected column back to the same value is not a change');
select * from public.__deletes('staff', 'staff', false);
select throws_ok(
  $$delete from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'staff cannot delete the business_settings row');
select throws_ok(
  $$insert into public.business_settings (business_id) values ('20000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'staff cannot insert a business_settings row');

-- ----------------------------------------------------------------------------
-- Manager
-- ----------------------------------------------------------------------------
set local "request.jwt.claims" = '{"sub": "a2000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select * from public.__protected_updates('manager', false);
select throws_ok(
  $$update public.businesses set slug = 'manager-slug' where id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'a manager cannot change the business slug');
select lives_ok(
  $$update public.businesses set description = 'Managed' where id = '10000000-0000-0000-0000-000000000001'$$,
  'a manager can still change the business profile');
select lives_ok(
  $$update public.business_settings set accepting_orders = false where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'a manager can still change ordering settings');
select * from public.__deletes('manager', 'manager', false);
select throws_ok(
  $$delete from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'a manager cannot delete the business_settings row');

-- ----------------------------------------------------------------------------
-- A business-B owner has no power over business A
-- ----------------------------------------------------------------------------
set local "request.jwt.claims" = '{"sub": "b1000000-0000-4000-8000-000000000004", "role": "authenticated"}';

update public.business_settings set revolut_revtag = '@intruder' where business_id = '10000000-0000-0000-0000-000000000001';
delete from public.orders where notes = 'del-outsider';
delete from public.expenses where description = 'del-outsider';
delete from public.guests where name = 'del-outsider';
delete from public.products where name = 'del-outsider';

reset role;
select is(
  (select (select count(*) from public.orders where notes = 'del-outsider')
        + (select count(*) from public.expenses where description = 'del-outsider')
        + (select count(*) from public.guests where name = 'del-outsider')
        + (select count(*) from public.products where name = 'del-outsider'))::int,
  4,
  'the owner of another business cannot hard-delete this business''s rows');
select is(
  (select revolut_revtag from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'),
  '@original',
  'the owner of another business cannot change this business''s payment identifier (row not visible)');

-- ----------------------------------------------------------------------------
-- Owner
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a1000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select * from public.__protected_updates('an owner', true);
select lives_ok(
  $$update public.businesses set slug = 'owner-new-slug' where id = '10000000-0000-0000-0000-000000000001'$$,
  'an owner can change the business slug');
select * from public.__deletes('an owner', 'owner', true);
select throws_ok(
  $$delete from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'not even an owner can delete the business_settings row through the API');
select is(
  (select count(*)::int from public.business_settings where business_id = '10000000-0000-0000-0000-000000000001'),
  1,
  'the business_settings row is still there');

-- ----------------------------------------------------------------------------
-- Exempt callers: service_role and direct database connections
-- ----------------------------------------------------------------------------
set local role service_role;
set local "request.jwt.claims" = '{"role": "service_role"}';
select lives_ok(
  $$update public.business_settings set revolut_revtag = '@service' where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'service_role can change a protected column (provisioning, support)');
select lives_ok(
  $$update public.businesses set slug = 'service-slug' where id = '10000000-0000-0000-0000-000000000001'$$,
  'service_role can change the slug');

reset role;
select lives_ok(
  $$update public.business_settings set wero_identifier = 'direct' where business_id = '10000000-0000-0000-0000-000000000001'$$,
  'a direct database connection can change a protected column');

-- D3: exactly one owner per business
select throws_ok(
  $$insert into public.business_members (business_id, user_id, role) values ('10000000-0000-0000-0000-000000000001', 'b1000000-0000-4000-8000-000000000004', 'owner')$$,
  '23505', null, 'a second owner of the same business is refused');
select lives_ok(
  $$insert into public.business_members (business_id, user_id, role) values ('20000000-0000-0000-0000-000000000002', 'a3000000-0000-4000-8000-000000000003', 'staff')$$,
  'extra non-owner members are still fine');

select * from finish();

rollback;
