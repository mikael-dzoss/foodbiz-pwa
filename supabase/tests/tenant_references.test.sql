-- ============================================================================
-- Test Suite: tenant_references.test.sql
-- Description: composite foreign keys refuse cross-tenant references for every relation
--              (products.category_id, orders.guest_id, order_items.order_id,
--              order_items.product_id), on insert and update, with the original ON DELETE
--              behaviours; case-insensitive category names are unique per business.
-- Runs as the table owner on purpose: the foreign keys are what is under test, not RLS.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(21);

insert into public.businesses (id, name, slug, currency)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Business A', 'tr-biz-a', 'EUR'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Business B', 'tr-biz-b', 'EUR');

insert into public.product_categories (id, business_id, name)
values
  ('ca000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Breads'),
  ('cb000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Mains');

insert into public.products (id, business_id, category_id, name, price, stock)
values
  ('da000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'ca000000-0000-0000-0000-000000000001'::uuid, 'Croissant', 500, 10),
  ('db000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'cb000000-0000-0000-0000-000000000002'::uuid, 'Quiche', 800, 10);

insert into public.guests (id, business_id, name, phone)
values
  ('9a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Alice Martin', '+33612345678'),
  ('9b000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'Bob Dupont', '+33687654321');

insert into public.orders (id, business_id, order_number, guest_id, service_type, channel, requested_date, total_amount)
values
  ('0a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 1, '9a000000-0000-0000-0000-000000000001'::uuid, 'pickup', 'storefront', current_date, 500),
  ('0b000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 1, '9b000000-0000-0000-0000-000000000002'::uuid, 'pickup', 'storefront', current_date, 800);

insert into public.order_items (id, order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
values
  ('1a000000-0000-0000-0000-000000000001'::uuid, '0a000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'da000000-0000-0000-0000-000000000001'::uuid, 'Croissant', 1, 500, 500);

-- ----------------------------------------------------------------------------
-- Structure: the composite keys exist and are validated, the single-column keys are gone
-- ----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_constraint
    where conname in ('products_business_category_fkey', 'orders_business_guest_fkey',
                      'order_items_business_order_fkey', 'order_items_business_product_fkey')
      and contype = 'f' and convalidated),
  4,
  'the four composite foreign keys exist and are validated'
);

select is(
  (select count(*)::int from pg_constraint
    where conname in ('products_category_id_fkey', 'orders_guest_id_fkey',
                      'order_items_order_id_fkey', 'order_items_product_id_fkey')),
  0,
  'the replaced single-column foreign keys are dropped'
);

-- ----------------------------------------------------------------------------
-- Cross-tenant insert rejected for each relation
-- ----------------------------------------------------------------------------
select throws_ok(
  $$insert into public.products (business_id, category_id, name, price)
    values ('10000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'Intruder', 100)$$,
  '23503', null, 'product cannot reference a category of another business (insert)'
);

select throws_ok(
  $$insert into public.orders (business_id, order_number, guest_id, service_type, channel, requested_date, total_amount)
    values ('10000000-0000-0000-0000-000000000001', 2, '9b000000-0000-0000-0000-000000000002', 'pickup', 'storefront', current_date, 100)$$,
  '23503', null, 'order cannot reference a guest of another business (insert)'
);

select throws_ok(
  $$insert into public.order_items (order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
    values ('0b000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'x', 1, 1, 1)$$,
  '23503', null, 'order item cannot sit on an order of another business (insert)'
);

select throws_ok(
  $$insert into public.order_items (order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
    values ('0a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'db000000-0000-0000-0000-000000000002', 'x', 1, 1, 1)$$,
  '23503', null, 'order item cannot reference a product of another business (insert)'
);

-- ----------------------------------------------------------------------------
-- Cross-tenant update rejected for each relation
-- ----------------------------------------------------------------------------
select throws_ok(
  $$update public.products set category_id = 'cb000000-0000-0000-0000-000000000002' where id = 'da000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'product cannot be re-pointed to a category of another business (update)'
);

select throws_ok(
  $$update public.orders set guest_id = '9b000000-0000-0000-0000-000000000002' where id = '0a000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'order cannot be re-pointed to a guest of another business (update)'
);

select throws_ok(
  $$update public.order_items set order_id = '0b000000-0000-0000-0000-000000000002' where id = '1a000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'order item cannot be moved to an order of another business (update)'
);

select throws_ok(
  $$update public.order_items set product_id = 'db000000-0000-0000-0000-000000000002' where id = '1a000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'order item cannot be re-pointed to a product of another business (update)'
);

select throws_ok(
  $$update public.order_items set business_id = '20000000-0000-0000-0000-000000000002' where id = '1a000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'order item cannot change business_id away from its order'
);

-- Same-tenant references still work
select lives_ok(
  $$insert into public.products (business_id, category_id, name, price)
    values ('10000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Same tenant', 100)$$,
  'a product can reference a category of its own business'
);

select lives_ok(
  $$insert into public.order_items (order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
    values ('0a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, 'Custom', 1, 1, 1)$$,
  'an order item with a null product_id (deleted product) is still accepted'
);

-- ----------------------------------------------------------------------------
-- ON DELETE behaviours are unchanged
-- ----------------------------------------------------------------------------
select throws_ok(
  $$delete from public.product_categories where id = 'ca000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'a category with products cannot be deleted (restrict)'
);

select throws_ok(
  $$delete from public.guests where id = '9a000000-0000-0000-0000-000000000001'$$,
  '23503', null, 'a guest with orders cannot be deleted (restrict)'
);

delete from public.products where id = 'da000000-0000-0000-0000-000000000001';

select is(
  (select product_id from public.order_items where id = '1a000000-0000-0000-0000-000000000001'),
  null,
  'deleting a product sets order_items.product_id to null (set null (product_id))'
);

select is(
  (select business_id from public.order_items where id = '1a000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'deleting a product keeps order_items.business_id (column-list set null)'
);

delete from public.orders where id = '0a000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.order_items where order_id = '0a000000-0000-0000-0000-000000000001'),
  0,
  'deleting an order cascades to its items'
);

-- ----------------------------------------------------------------------------
-- Case-insensitive category names
-- ----------------------------------------------------------------------------
select throws_ok(
  $$insert into public.product_categories (business_id, name) values ('10000000-0000-0000-0000-000000000001', ' BREADS ')$$,
  '23505', null, 'category names are unique per business ignoring case and surrounding spaces'
);

select lives_ok(
  $$insert into public.product_categories (business_id, name) values ('20000000-0000-0000-0000-000000000002', 'Breads')$$,
  'the same category name is allowed in another business'
);

-- No invalid index is left behind by the concurrent builds
select is(
  (select count(*)::int from pg_index where not indisvalid),
  0,
  'no invalid index exists'
);

select * from finish();

rollback;
