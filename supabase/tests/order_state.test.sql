-- ============================================================================
-- Test Suite: order_state.test.sql
-- Description: order writes are server-side only. Members cannot rewrite money/integrity
--              fields directly; every status pair of the lifecycle; optimistic concurrency;
--              payments, unpaid and refund rules; replace_order_items (server-side prices,
--              recomputed total, stock delta, closed orders); function privileges.
-- Deliberately does NOT re-grant table privileges: the privileges the migrations leave in place
-- are what is under test.
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(126);

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
  ('10000000-0000-0000-0000-000000000001', 'Business A', 'os-biz-a', 'EUR'),
  ('20000000-0000-0000-0000-000000000002', 'Business B', 'os-biz-b', 'EUR');

insert into public.business_settings (business_id, delivery_fee)
values
  ('10000000-0000-0000-0000-000000000001', 250),
  ('20000000-0000-0000-0000-000000000002', 0);

insert into public.business_members (business_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'manager'),
  ('10000000-0000-0000-0000-000000000001', 'a3000000-0000-4000-8000-000000000003', 'staff'),
  ('20000000-0000-0000-0000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'owner');

insert into public.product_categories (id, business_id, name)
values
  ('ca000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Breads'),
  ('cb000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Mains');

insert into public.products (id, business_id, category_id, name, price, stock)
values
  ('da000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Croissant', 500, 10),
  ('da000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Baguette', 300, 20),
  ('db000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000002', 'Quiche', 800, 10);

insert into public.guests (id, business_id, name, phone)
values
  ('9a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Alice Martin', '+33612345678'),
  ('9b000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Bob Dupont', '+33687654321');

-- One order per (from status, to status) pair, paid so that only the transition table decides.
insert into public.orders (business_id, order_number, guest_id, service_type, channel, status, paid, payment_method, paid_at, requested_date, total_amount, notes)
select '10000000-0000-0000-0000-000000000001', 1000 + row_number() over (), '9a000000-0000-0000-0000-000000000001',
       'pickup', 'phone', f.s, 'paid', 'cash', now(), current_date, 500, f.s::text || '>' || t.s::text
from unnest(enum_range(null::public.order_status)) as f(s)
cross join unnest(enum_range(null::public.order_status)) as t(s);

-- Named orders for the targeted tests (A = business A, B = business B)
insert into public.orders (id, business_id, order_number, guest_id, service_type, channel, status, paid, payment_method, paid_at, requested_date, total_amount, notes)
values
  ('0a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, '9a000000-0000-0000-0000-000000000001', 'delivery', 'storefront', 'NEW', 'unpaid', null, null, current_date, 1500, 'edit me'),
  ('0a000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'NEW', 'unpaid', null, null, current_date, 500, 'conflict'),
  ('0a000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'NEW', 'unpaid', null, null, current_date, 500, 'unpaid to completed'),
  ('0a000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 4, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'READY', 'refunded', 'cash', now(), current_date, 500, 'refunded ready'),
  ('0a000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 5, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'CONFIRMED', 'unpaid', null, null, current_date, 500, 'payments'),
  ('0a000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 6, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'READY', 'unpaid', null, null, current_date, 500, 'pay and complete'),
  ('0a000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 7, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'CANCELLED', 'unpaid', null, null, current_date, 500, 'cancelled'),
  ('0a000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 8, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'NEW', 'unpaid', null, null, current_date, 1000, 'cancel with stock'),
  ('0a000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 9, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'COMPLETED', 'paid', 'cash', now(), current_date, 500, 'completed'),
  ('0b000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 1, '9b000000-0000-0000-0000-000000000002', 'pickup', 'storefront', 'NEW', 'unpaid', null, null, current_date, 800, 'tenant b');

-- Order 1 (delivery, fee 250): 2 x Croissant (500) + 1 x Baguette (300) = 1300 + 250 = 1550?
-- Seeded total 1500 on purpose is wrong; replace_order_items must recompute it.
insert into public.order_items (id, order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
values
  ('1a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Croissant (old name)', 2, 450, 900),
  ('1a000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000002', 'Baguette', 2, 300, 600);

-- Stock currently reserved by those two orders: 2 croissants and 2 baguettes
update public.products set stock = 8 where id = 'da000000-0000-0000-0000-000000000001';
update public.products set stock = 18 where id = 'da000000-0000-0000-0000-000000000002';

-- Order 10: PREPARING with 3 croissants reserved (for the cancel-through-transition test)
insert into public.orders (id, business_id, order_number, guest_id, service_type, channel, status, paid, payment_method, paid_at, requested_date, total_amount, notes)
values ('0a000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 10, '9a000000-0000-0000-0000-000000000001', 'pickup', 'storefront', 'PREPARING', 'unpaid', null, null, current_date, 1500, 'cancel via transition');
insert into public.order_items (order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
values ('0a000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Croissant', 3, 500, 1500);
update public.products set stock = 8 where id = 'da000000-0000-0000-0000-000000000001';

-- Iterates the lifecycle: every (from, to) pair, allowed or not. The allowed list is a copy of
-- ALLOWED_ORDER_TRANSITIONS in src/domain/order-lifecycle.ts (the live vitest contract compares the
-- database with the domain table itself).
create function public.__order_pairs()
returns setof text
language plpgsql
as $$
declare
  s public.order_status;
  t public.order_status;
  v_id uuid;
  v_allowed text[] := array[
    'NEW>CONFIRMED', 'NEW>CANCELLED',
    'CONFIRMED>PREPARING', 'CONFIRMED>CANCELLED',
    'PREPARING>READY', 'PREPARING>CANCELLED',
    'READY>COMPLETED', 'READY>CANCELLED'
  ];
begin
  for s in select unnest(enum_range(null::public.order_status)) loop
    for t in select unnest(enum_range(null::public.order_status)) loop
      select id into v_id from public.orders
       where business_id = '10000000-0000-0000-0000-000000000001' and notes = s::text || '>' || t::text;
      if (s::text || '>' || t::text) = any (v_allowed) then
        return next lives_ok(
          format('select public.transition_order_status(%L, %L, %L, %L, %L)',
                 '10000000-0000-0000-0000-000000000001', v_id, s, t, 'because'),
          format('%s -> %s is allowed', s, t));
      else
        return next throws_ok(
          format('select public.transition_order_status(%L, %L, %L, %L, %L)',
                 '10000000-0000-0000-0000-000000000001', v_id, s, t, 'because'),
          '22023', null,
          format('%s -> %s is refused', s, t));
      end if;
    end loop;
  end loop;
end;
$$;
grant execute on function public.__order_pairs() to authenticated;

-- ----------------------------------------------------------------------------
-- Direct writes are closed to members (manager of business A)
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a2000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok($$update public.orders set total_amount = 1 where id = '0a000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a member cannot update orders.total_amount directly');
select throws_ok($$update public.orders set tracking_token = 'stolen' where id = '0a000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a member cannot update orders.tracking_token directly');
select throws_ok($$update public.orders set business_id = '20000000-0000-0000-0000-000000000002' where id = '0a000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a member cannot update orders.business_id directly');
select throws_ok($$update public.orders set status = 'COMPLETED' where id = '0a000000-0000-0000-0000-000000000002'$$,
  '42501', null, 'a member cannot update orders.status directly');
select throws_ok($$update public.order_items set unit_price = 1 where id = '1a000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'a member cannot update order_items directly');
select throws_ok($$delete from public.order_items where id = '1a000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'a member cannot delete order_items directly');
select throws_ok($$insert into public.orders (business_id, order_number, guest_id, service_type, channel, requested_date, total_amount)
  values ('10000000-0000-0000-0000-000000000001', 99, '9a000000-0000-0000-0000-000000000001', 'pickup', 'phone', current_date, 1)$$,
  '42501', null, 'a member cannot insert orders directly');
select throws_ok($$insert into public.order_items (order_id, business_id, product_name, quantity, unit_price, total_price)
  values ('0a000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'x', 1, 1, 1)$$,
  '42501', null, 'a member cannot insert order_items directly');
delete from public.orders where id = '0a000000-0000-0000-0000-000000000002';
select is(
  (select count(*)::int from public.orders where id = '0a000000-0000-0000-0000-000000000002'),
  1,
  'a manager cannot hard-delete an order (owner only): the row is still there'
);

set local role anon;
set local "request.jwt.claims" = '{"role": "anon"}';
select throws_ok($$update public.orders set total_amount = 1$$,
  '42501', null, 'anon cannot update orders');

-- ----------------------------------------------------------------------------
-- Every status pair of the lifecycle
-- ----------------------------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a2000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select * from public.__order_pairs();

select is(
  (select count(*)::int from public.orders
    where business_id = '10000000-0000-0000-0000-000000000001'
      and notes ~ '^[A-Z]+>[A-Z]+$'
      and split_part(notes, '>', 1) <> split_part(notes, '>', 2)
      and status::text = split_part(notes, '>', 2)),
  8,
  'exactly the 8 allowed pairs changed the order status'
);

-- ----------------------------------------------------------------------------
-- Transition rules, optimistic concurrency, history
-- ----------------------------------------------------------------------------
select throws_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'NEW', 'CANCELLED', null)$$,
  '22023', null, 'rejecting a NEW order requires a reason');
select throws_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'NEW', 'CANCELLED', '   ')$$,
  '22023', null, 'a blank reason does not count');
select throws_like(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'CONFIRMED', 'PREPARING', null)$$,
  'ORDER_STATE_CONFLICT%', 'a stale expected status fails with ORDER_STATE_CONFLICT');
select throws_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'CONFIRMED', 'PREPARING', null)$$,
  'P0007', null, 'ORDER_STATE_CONFLICT uses SQLSTATE P0007');
select throws_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000006', 'READY', 'COMPLETED', null)$$,
  '22023', null, 'READY -> COMPLETED is refused while the order is unpaid');
select throws_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000004', 'READY', 'COMPLETED', null)$$,
  '22023', null, 'READY -> COMPLETED is refused while the order is refunded');
select lives_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'NEW', 'CONFIRMED', 'accepted')$$,
  'NEW -> CONFIRMED with the expected status succeeds');
select is(
  (select jsonb_array_length(status_history) from public.orders where id = '0a000000-0000-0000-0000-000000000002'),
  2,
  'the history has the initial entry plus the transition');
select is(
  (select status_history -> 1 ->> 'status' from public.orders where id = '0a000000-0000-0000-0000-000000000002'),
  'CONFIRMED',
  'the transition was appended in the same statement');
select is(
  (select status_history -> 1 ->> 'note' from public.orders where id = '0a000000-0000-0000-0000-000000000002'),
  'accepted',
  'the reason is stored as the note');
select throws_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'NEW', 'CONFIRMED', null)$$,
  'P0007', null, 'replaying the same call conflicts (the order is no longer NEW)');
select throws_ok(
  $$select public.transition_order_status('20000000-0000-0000-0000-000000000002', '0b000000-0000-0000-0000-000000000001', 'NEW', 'CONFIRMED', null)$$,
  '42501', null, 'a member of A cannot transition an order of B');

-- cancel through transition_order_status restores stock
select lives_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-00000000000a', 'PREPARING', 'CANCELLED', 'customer left')$$,
  'PREPARING -> CANCELLED succeeds');
select is((select stock from public.products where id = 'da000000-0000-0000-0000-000000000001'), 11,
  'cancelling through transition_order_status restores stock');
select is((select cancellation_reason from public.orders where id = '0a000000-0000-0000-0000-00000000000a'), 'customer left',
  'the cancellation reason is stored');

-- cancel_order writes its own history entry
select lives_ok(
  $$select public.cancel_order('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000008', 'no show')$$,
  'cancel_order succeeds');
select is((select stock from public.products where id = 'da000000-0000-0000-0000-000000000002'), 20,
  'cancel_order restores stock');
select is(
  (select status_history -> -1 ->> 'status' from public.orders where id = '0a000000-0000-0000-0000-000000000008'),
  'CANCELLED',
  'cancel_order appends its own status_history entry');
select is(
  (select jsonb_array_length(status_history) from public.orders where id = '0a000000-0000-0000-0000-000000000008'),
  2,
  'cancel_order leaves exactly the initial entry plus its own');
select throws_ok(
  $$select public.cancel_order('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000009', null)$$,
  '22023', null, 'a COMPLETED order cannot be cancelled');

-- ----------------------------------------------------------------------------
-- Payments
-- ----------------------------------------------------------------------------
select lives_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000005', 'cash')$$,
  'record payment on a CONFIRMED order');
select is((select paid::text || '/' || payment_method::text from public.orders where id = '0a000000-0000-0000-0000-000000000005'), 'paid/cash',
  'the order is paid by cash');
select lives_ok(
  $$select public.mark_order_unpaid('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000005')$$,
  'mark unpaid undoes the payment');
select is((select paid::text || '/' || coalesce(payment_method::text, 'none') from public.orders where id = '0a000000-0000-0000-0000-000000000005'), 'unpaid/none',
  'the payment method and date are cleared');
select is((select status_history -> -1 ->> 'note' from public.orders where id = '0a000000-0000-0000-0000-000000000005'),
  'Payment marked as unpaid (undone)', 'mark unpaid writes a history entry');
select throws_ok(
  $$select public.mark_order_unpaid('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000005')$$,
  '22023', null, 'an already unpaid order cannot be marked unpaid');
select lives_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000005', 'cash')$$,
  'record payment again after undoing it');
select throws_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000005', 'wero')$$,
  '22023', null, 'an already paid order cannot be paid again (no overwrite)');
select is((select payment_method::text from public.orders where id = '0a000000-0000-0000-0000-000000000005'), 'cash',
  'the original payment method is kept');
select is((select status_history -> -1 ->> 'note' from public.orders where id = '0a000000-0000-0000-0000-000000000005'), 'Paid via cash',
  'recording a payment appends a history entry');
select lives_ok(
  $$select public.mark_order_unpaid('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000005')$$,
  'undo the payment again');
select throws_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000007', 'cash')$$,
  '22023', null, 'payment cannot be recorded on a cancelled order');
select throws_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000004', 'cash')$$,
  '22023', null, 'payment cannot be re-recorded on a refunded order');
select throws_ok(
  $$select public.mark_order_unpaid('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000009')$$,
  '22023', null, 'a COMPLETED order cannot be marked unpaid');
select throws_ok(
  $$select public.mark_order_unpaid('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000004')$$,
  '22023', null, 'a refunded order cannot be marked unpaid');
select throws_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000005', 'cash', true)$$,
  'P0007', null, 'mark paid and complete requires a READY order');
select lives_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000006', 'wero', true)$$,
  'mark paid and complete on a READY order');
select is((select status::text || '/' || paid::text from public.orders where id = '0a000000-0000-0000-0000-000000000006'), 'COMPLETED/paid',
  'the order is COMPLETED and paid in one step');
select is((select status_history -> -1 ->> 'note' from public.orders where id = '0a000000-0000-0000-0000-000000000006'),
  'Paid via wero and completed', 'the combined step writes one history entry');
select throws_ok(
  $$select public.record_order_refund('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000006', 'x')$$,
  '42501', null, 'a manager cannot record a refund (owner only)');
set local "request.jwt.claims" = '{"sub": "a1000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$select public.record_order_refund('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', null)$$,
  '22023', null, 'an unpaid order cannot be refunded');
select lives_ok(
  $$select public.record_order_refund('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000006', 'dispute')$$,
  'a paid COMPLETED order can be refunded');
select is((select paid::text || '/' || (refunded_at is not null)::text from public.orders where id = '0a000000-0000-0000-0000-000000000006'), 'refunded/true',
  'the order is refunded with a refunded_at');
select is((select status_history -> -1 ->> 'note' from public.orders where id = '0a000000-0000-0000-0000-000000000006'),
  'Refund recorded: dispute', 'the refund reason is in the history');
select throws_ok(
  $$select public.record_order_refund('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000006', null)$$,
  '22023', null, 'a refunded order cannot be refunded again');
set local "request.jwt.claims" = '{"sub": "a2000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$select public.record_order_payment('20000000-0000-0000-0000-000000000002', '0b000000-0000-0000-0000-000000000001', 'cash')$$,
  '42501', null, 'a member of A cannot record a payment on an order of B');

-- ----------------------------------------------------------------------------
-- replace_order_items (as staff: any member may edit items)
-- ----------------------------------------------------------------------------
set local "request.jwt.claims" = '{"sub": "a3000000-0000-4000-8000-000000000003", "role": "authenticated"}';

select lives_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[
      {"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 3, "product_name": "Hacked", "unit_price": 1, "total_price": 1},
      {"product_id": "da000000-0000-0000-0000-000000000002", "quantity": 1, "unit_price": 1, "total_price": 1}
    ]'::jsonb)$$,
  'replace_order_items succeeds with client-supplied prices and names');
select is((select total_amount from public.orders where id = '0a000000-0000-0000-0000-000000000001'), 1900,
  'the order total is recomputed: 3x450 snapshot + 1x300 + 250 delivery fee');
select is((select unit_price from public.order_items where order_id = '0a000000-0000-0000-0000-000000000001' and product_id = 'da000000-0000-0000-0000-000000000001'), 450,
  'an existing line keeps its snapshot price');
select is((select product_name from public.order_items where order_id = '0a000000-0000-0000-0000-000000000001' and product_id = 'da000000-0000-0000-0000-000000000001'), 'Croissant (old name)',
  'the client-supplied name is ignored');
select is((select unit_price from public.order_items where order_id = '0a000000-0000-0000-0000-000000000001' and product_id = 'da000000-0000-0000-0000-000000000002'), 300,
  'a new line takes the current catalog price, not the client price');
select is((select sum(total_price)::int from public.order_items where order_id = '0a000000-0000-0000-0000-000000000001'), 1650,
  'line totals are recomputed server-side');
select is((select stock from public.products where id = 'da000000-0000-0000-0000-000000000001'), 10,
  'stock moves by the delta: +1 croissant reserved');
select is((select stock from public.products where id = 'da000000-0000-0000-0000-000000000002'), 19,
  'stock moves by the delta: 1 new baguette reserved');

select lives_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[
      {"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1},
      {"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 2}
    ]'::jsonb)$$,
  'duplicate lines are accepted and summed');
select is((select count(*)::int || '/' || max(quantity) from public.order_items where order_id = '0a000000-0000-0000-0000-000000000001'), '1/3',
  'duplicates are merged into one line of 3');
select is((select stock from public.products where id = 'da000000-0000-0000-0000-000000000002'), 20,
  'a removed line gives its stock back');
select is((select total_amount from public.orders where id = '0a000000-0000-0000-0000-000000000001'), 1600,
  'the total follows the lines: 3x450 + 250 delivery fee');

select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 9999}]'::jsonb)$$,
  'P0001', null, 'not enough stock is refused');
select is((select stock from public.products where id = 'da000000-0000-0000-0000-000000000001'), 10,
  'a refused edit leaves stock untouched');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "db000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'P0002', null, 'a product of another business is refused');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[]'::jsonb)$$,
  '22023', null, 'an empty item list is refused');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 0}]'::jsonb)$$,
  '22023', null, 'quantity 0 is refused');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1.5}]'::jsonb)$$,
  '22023', null, 'a fractional quantity is refused');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000009', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'P0007', null, 'a COMPLETED order refuses item changes');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000007', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'P0007', null, 'a CANCELLED order refuses item changes');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000004', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'P0007', null, 'a refunded order refuses item changes');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'P0002', null, 'an unknown order is refused');

-- M1: a line whose product was hard-deleted (product_id null) survives and counts in the total
reset role;
insert into public.order_items (order_id, business_id, product_id, product_name, quantity, unit_price, total_price)
values ('0a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', null, 'Deleted product', 1, 500, 500);
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a3000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select lives_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 3}]'::jsonb)$$,
  'replace_order_items works on an order with an orphan line');
select is((select count(*)::int from public.order_items where order_id = '0a000000-0000-0000-0000-000000000001' and product_id is null), 1,
  'the orphan line is kept');
select is((select total_amount from public.orders where id = '0a000000-0000-0000-0000-000000000001'), 2100,
  'the total includes the orphan line: 3x450 + 500 + 250 delivery fee');

-- M3: subtotal plus delivery fee is checked against the cap
reset role;
update public.business_settings set delivery_fee = 2000000000 where business_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a3000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 3}]'::jsonb)$$,
  '22023', null, 'subtotal + delivery fee over the cap raises the clear error, not an overflow');
reset role;
update public.business_settings set delivery_fee = 250 where business_id = '10000000-0000-0000-0000-000000000001';
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a3000000-0000-4000-8000-000000000003", "role": "authenticated"}';

-- D1: no content edits on a paid order
select lives_ok(
  $$select public.record_order_payment('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'cash')$$,
  'pay the order');
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  'P0007', null, 'a paid order refuses item changes');

-- Non-members and anon
set local "request.jwt.claims" = '{"sub": "b1000000-0000-4000-8000-000000000004", "role": "authenticated"}';
select throws_ok(
  $$select public.replace_order_items('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '[{"product_id": "da000000-0000-0000-0000-000000000001", "quantity": 1}]'::jsonb)$$,
  '42501', null, 'a member of another business cannot edit items');

set local role anon;
set local "request.jwt.claims" = '{"role": "anon"}';
select throws_ok(
  $$select public.transition_order_status('10000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', 'NEW', 'CONFIRMED', null)$$,
  '42501', null, 'anon cannot call transition_order_status');
reset role;

-- ----------------------------------------------------------------------------
-- Function privileges
-- ----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('transition_order_status', 'record_order_payment', 'mark_order_unpaid',
                        'record_order_refund', 'replace_order_items', 'cancel_order')
      and (has_function_privilege('anon', p.oid, 'execute')
           or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0))),
  0,
  'no order function is executable by anon or PUBLIC');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('transition_order_status', 'record_order_payment', 'mark_order_unpaid',
                        'record_order_refund', 'replace_order_items', 'cancel_order')
      and has_function_privilege('authenticated', p.oid, 'execute')),
  6,
  'authenticated can execute the six order functions');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('apply_order_transition', 'order_total_cents', 'order_history_entry', 'enforce_owner_only_columns')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
           or exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0))),
  0,
  'internal helpers are not executable by anon, authenticated or PUBLIC');

select * from finish();

rollback;
