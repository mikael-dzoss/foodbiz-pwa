-- ============================================================================
-- Migration: 20260101000024_order_state_functions.sql
-- Description: Order state changes move into the database so they are atomic, validated and
--   consistent. Until now the app read an order, validated in TypeScript and wrote the whole row
--   back (read-modify-write of status_history, cancel = RPC then a second update, ...). Members
--   will lose the right to write orders directly in 20260101000027.
--
--   * orders_init_status_history (trigger): every new order starts with a status_history entry
--     (place_order never wrote one).
--   * order_total_cents: the one place that knows how an order total is made (items subtotal plus
--     the delivery fee of a delivery order). place_order (20260101000025) and replace_order_items
--     (20260101000026) both call it.
--   * apply_order_transition: internal core (not callable through the API). Locks the order,
--     checks the expected status (optimistic concurrency), checks the transition table of
--     src/domain/order-lifecycle.ts, restores stock on cancellation and appends status_history
--     in the same statement.
--   * transition_order_status: authorised RPC around the core. The transition table is mirrored
--     from the domain; a live contract test iterates the domain table and fails if they diverge.
--   * cancel_order: same signature as before, now a thin wrapper: no reason required (as before),
--     writes its own status_history entry.
--   * record_order_payment (also "mark paid and complete"), mark_order_unpaid, record_order_refund.
--
--   Error codes (message prefix / SQLSTATE):
--     ORDER_NOT_FOUND P0002, ORDER_STATE_CONFLICT P0007 (the order is not in the state the call
--     expected or needs), INVALID_STATUS_TRANSITION / INVALID_PAYMENT_STATE 22023,
--     permission denied 42501.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.record_order_refund(uuid, uuid, text);
--   drop function if exists public.mark_order_unpaid(uuid, uuid);
--   drop function if exists public.record_order_payment(uuid, uuid, public.order_payment_method, boolean);
--   drop function if exists public.transition_order_status(uuid, uuid, public.order_status, public.order_status, text);
--   drop function if exists public.apply_order_transition(uuid, uuid, public.order_status, public.order_status, text, boolean);
--   drop function if exists public.order_total_cents(uuid, public.order_service_type, integer);
--   drop trigger if exists orders_init_status_history on public.orders;
--   drop function if exists public.orders_init_status_history();
--   -- cancel_order: re-create the version from 20260101000014.
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. Initial status_history entry
-- ----------------------------------------------------------------------------
create or replace function public.orders_init_status_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status_history is null or new.status_history = '[]'::jsonb then
    new.status_history := jsonb_build_array(
      jsonb_build_object(
        'status', new.status,
        'timestamp', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'note', case
          when new.channel = 'storefront' then 'Order placed via online storefront'
          else 'Order placed via ' || new.channel::text
        end
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_init_status_history on public.orders;
create trigger orders_init_status_history
  before insert on public.orders
  for each row execute function public.orders_init_status_history();

-- ----------------------------------------------------------------------------
-- 2. One definition of an order total
-- ----------------------------------------------------------------------------
-- items subtotal + delivery fee for delivery orders (mirrors calculateOrderTotals in
-- src/domain/pricing.ts). Tax is not part of the total. Internal: only SECURITY DEFINER
-- functions call it.
create or replace function public.order_total_cents(
  p_business_id uuid,
  p_service_type public.order_service_type,
  p_subtotal integer
)
returns integer
language sql
stable
set search_path = ''
as $$
  select p_subtotal + case
    when p_service_type = 'delivery' then coalesce(
      (select greatest(0, s.delivery_fee) from public.business_settings s where s.business_id = p_business_id),
      0
    )
    else 0
  end;
$$;

revoke all on function public.order_total_cents(uuid, public.order_service_type, integer)
  from public, anon, authenticated;
grant execute on function public.order_total_cents(uuid, public.order_service_type, integer)
  to service_role;

-- ----------------------------------------------------------------------------
-- 3. Internal helpers
-- ----------------------------------------------------------------------------
create or replace function public.order_history_entry(p_status public.order_status, p_note text)
returns jsonb
language sql
set search_path = ''
as $$
  select jsonb_build_object(
    'status', p_status,
    'timestamp', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'note', p_note
  );
$$;

revoke all on function public.order_history_entry(public.order_status, text)
  from public, anon, authenticated;
grant execute on function public.order_history_entry(public.order_status, text) to service_role;

-- Core of every status change. Callers authorise first; this is not exposed through the API.
-- p_expected_status null = no optimistic check (cancel_order keeps its old contract).
create or replace function public.apply_order_transition(
  p_business_id uuid,
  p_order_id uuid,
  p_expected_status public.order_status,
  p_new_status public.order_status,
  p_reason text,
  p_require_reason boolean
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_allowed public.order_status[];
begin
  select * into v_order
  from public.orders
  where id = p_order_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % not found for business %', p_order_id, p_business_id using errcode = 'P0002';
  end if;

  if p_expected_status is not null and v_order.status <> p_expected_status then
    raise exception 'ORDER_STATE_CONFLICT: expected status % but the order is %', p_expected_status, v_order.status using errcode = 'P0007';
  end if;

  if v_order.status = p_new_status then
    raise exception 'INVALID_STATUS_TRANSITION: order is already in % status', v_order.status using errcode = '22023';
  end if;

  -- Transition table: keep identical to ALLOWED_ORDER_TRANSITIONS in src/domain/order-lifecycle.ts.
  v_allowed := case v_order.status
    when 'NEW' then array['CONFIRMED', 'CANCELLED']::public.order_status[]
    when 'CONFIRMED' then array['PREPARING', 'CANCELLED']::public.order_status[]
    when 'PREPARING' then array['READY', 'CANCELLED']::public.order_status[]
    when 'READY' then array['COMPLETED', 'CANCELLED']::public.order_status[]
    else array[]::public.order_status[]
  end;

  if not (p_new_status = any (v_allowed)) then
    raise exception 'INVALID_STATUS_TRANSITION: cannot transition order from % to %', v_order.status, p_new_status using errcode = '22023';
  end if;

  if p_require_reason and v_order.status = 'NEW' and p_new_status = 'CANCELLED' and v_reason is null then
    raise exception 'INVALID_STATUS_TRANSITION: a reason is required when rejecting a new order' using errcode = '22023';
  end if;

  if p_new_status = 'COMPLETED' then
    if v_order.paid = 'refunded' then
      raise exception 'INVALID_STATUS_TRANSITION: cannot transition to COMPLETED while order is refunded' using errcode = '22023';
    end if;
    if v_order.paid <> 'paid' then
      raise exception 'INVALID_STATUS_TRANSITION: cannot transition to COMPLETED while order is unpaid' using errcode = '22023';
    end if;
  end if;

  if p_new_status = 'CANCELLED' then
    update public.products p
    set stock = p.stock + agg.qty
    from (
      select oi.product_id, sum(oi.quantity)::integer as qty
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.business_id = p_business_id
        and oi.product_id is not null
      group by oi.product_id
    ) agg
    where p.id = agg.product_id
      and p.business_id = p_business_id;
  end if;

  update public.orders
  set status = p_new_status,
      cancellation_reason = case
        when p_new_status = 'CANCELLED' then coalesce(v_reason, cancellation_reason)
        else cancellation_reason
      end,
      status_history = coalesce(status_history, '[]'::jsonb)
        || jsonb_build_array(public.order_history_entry(p_new_status, v_reason))
  where id = p_order_id
    and business_id = p_business_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.apply_order_transition(uuid, uuid, public.order_status, public.order_status, text, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_order_transition(uuid, uuid, public.order_status, public.order_status, text, boolean)
  to service_role;

-- ----------------------------------------------------------------------------
-- 4. transition_order_status
-- ----------------------------------------------------------------------------
create or replace function public.transition_order_status(
  p_business_id uuid,
  p_order_id uuid,
  p_expected_status public.order_status,
  p_new_status public.order_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for transition_order_status' using errcode = '42501';
  end if;

  if p_expected_status is null or p_new_status is null then
    raise exception 'INVALID_STATUS_TRANSITION: expected and new status are required' using errcode = '22023';
  end if;

  v_order := public.apply_order_transition(p_business_id, p_order_id, p_expected_status, p_new_status, p_reason, true);

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', v_order.status,
    'cancellation_reason', v_order.cancellation_reason
  );
end;
$$;

revoke all on function public.transition_order_status(uuid, uuid, public.order_status, public.order_status, text)
  from public, anon;
grant execute on function public.transition_order_status(uuid, uuid, public.order_status, public.order_status, text)
  to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. cancel_order (same signature and result; now writes its status_history entry itself)
-- ----------------------------------------------------------------------------
create or replace function public.cancel_order(
  p_business_id uuid,
  p_order_id uuid,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for cancel_order' using errcode = '42501';
  end if;

  v_order := public.apply_order_transition(p_business_id, p_order_id, null, 'CANCELLED', p_cancellation_reason, false);

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', 'CANCELLED',
    'cancellation_reason', v_order.cancellation_reason
  );
end;
$$;

revoke all on function public.cancel_order(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, uuid, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Payments
-- ----------------------------------------------------------------------------
-- Records payment (any status except CANCELLED, never on a refunded order). With p_and_complete
-- (the "mark paid and complete" shortcut) the order must be READY and becomes COMPLETED in the
-- same statement.
create or replace function public.record_order_payment(
  p_business_id uuid,
  p_order_id uuid,
  p_payment_method public.order_payment_method,
  p_and_complete boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for record_order_payment' using errcode = '42501';
  end if;

  if p_payment_method is null then
    raise exception 'INVALID_PAYMENT_STATE: a payment method is required' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % not found for business %', p_order_id, p_business_id using errcode = 'P0002';
  end if;

  if v_order.status = 'CANCELLED' then
    raise exception 'INVALID_PAYMENT_STATE: payment cannot be recorded for a cancelled order' using errcode = '22023';
  end if;

  if v_order.paid = 'refunded' then
    raise exception 'INVALID_PAYMENT_STATE: payment cannot be recorded for a refunded order' using errcode = '22023';
  end if;

  if coalesce(p_and_complete, false) then
    if v_order.status <> 'READY' then
      raise exception 'ORDER_STATE_CONFLICT: order must be READY to mark paid and complete (it is %)', v_order.status using errcode = 'P0007';
    end if;

    update public.orders
    set paid = 'paid',
        payment_method = p_payment_method,
        paid_at = now(),
        status = 'COMPLETED',
        status_history = coalesce(status_history, '[]'::jsonb)
          || jsonb_build_array(public.order_history_entry('COMPLETED', 'Paid via ' || p_payment_method::text || ' and completed'))
    where id = p_order_id and business_id = p_business_id
    returning * into v_order;
  else
    update public.orders
    set paid = 'paid',
        payment_method = p_payment_method,
        paid_at = now()
    where id = p_order_id and business_id = p_business_id
    returning * into v_order;
  end if;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'paid', v_order.paid);
end;
$$;

revoke all on function public.record_order_payment(uuid, uuid, public.order_payment_method, boolean)
  from public, anon;
grant execute on function public.record_order_payment(uuid, uuid, public.order_payment_method, boolean)
  to authenticated, service_role;

-- Undo a payment: not on a COMPLETED, refunded or already unpaid order.
create or replace function public.mark_order_unpaid(
  p_business_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for mark_order_unpaid' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % not found for business %', p_order_id, p_business_id using errcode = 'P0002';
  end if;

  if v_order.status = 'COMPLETED' then
    raise exception 'INVALID_PAYMENT_STATE: cannot mark a completed order as unpaid' using errcode = '22023';
  end if;
  if v_order.paid = 'refunded' then
    raise exception 'INVALID_PAYMENT_STATE: cannot mark a refunded order as unpaid' using errcode = '22023';
  end if;
  if v_order.paid = 'unpaid' then
    raise exception 'INVALID_PAYMENT_STATE: order is already marked as unpaid' using errcode = '22023';
  end if;

  update public.orders
  set paid = 'unpaid',
      payment_method = null,
      paid_at = null,
      status_history = coalesce(status_history, '[]'::jsonb)
        || jsonb_build_array(public.order_history_entry(v_order.status, 'Payment marked as unpaid (undone)'))
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'paid', v_order.paid);
end;
$$;

revoke all on function public.mark_order_unpaid(uuid, uuid) from public, anon;
grant execute on function public.mark_order_unpaid(uuid, uuid) to authenticated, service_role;

-- Refund: only a paid order (any status, e.g. a cancelled paid order or a post-delivery dispute).
create or replace function public.record_order_refund(
  p_business_id uuid,
  p_order_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for record_order_refund' using errcode = '42501';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % not found for business %', p_order_id, p_business_id using errcode = 'P0002';
  end if;

  if v_order.paid = 'refunded' then
    raise exception 'INVALID_PAYMENT_STATE: order is already marked as refunded' using errcode = '22023';
  end if;
  if v_order.paid = 'unpaid' then
    raise exception 'INVALID_PAYMENT_STATE: cannot refund an unpaid order' using errcode = '22023';
  end if;

  update public.orders
  set paid = 'refunded',
      refunded_at = now(),
      status_history = coalesce(status_history, '[]'::jsonb)
        || jsonb_build_array(public.order_history_entry(
             v_order.status,
             case when v_reason is null then 'Refund recorded' else 'Refund recorded: ' || v_reason end
           ))
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'paid', v_order.paid);
end;
$$;

revoke all on function public.record_order_refund(uuid, uuid, text) from public, anon;
grant execute on function public.record_order_refund(uuid, uuid, text) to authenticated, service_role;

reset lock_timeout;
