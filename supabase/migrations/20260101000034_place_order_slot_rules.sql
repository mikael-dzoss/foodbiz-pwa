-- ============================================================================
-- Migration: 20260101000034_place_order_slot_rules.sql
-- Description: Server-side opening-hours enforcement for storefront orders
--              (#373 closed shop = scheduled only, #374 scheduled date/time rules).
--
--   place_order gains a trailing `p_is_asap boolean default false` and, for the
--   storefront channel, replaces the [yesterday, +60 days] date window with
--   public.slot_error(...) from 20260101000033 (window [today, today+30] in the
--   business timezone; ASAP only while open; scheduled slot on an open day/time
--   in the future). Failures raise `SLOT_INVALID: <reason>` (errcode 22023) with
--   reason in date_out_of_window | closed_now | closed_day | time_outside_hours |
--   time_in_past. Manual (manager) orders are unchanged. `p_is_asap` is part of
--   the idempotency payload hash.
--
--   The signature changes, so the 13-argument overload is dropped first (no stale
--   overload). Grants are restated as in 20260101000014.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid, boolean);
--   -- re-create place_order from 20260101000032_card_payment_method.sql
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

drop function if exists public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid);

create or replace function public.place_order(
  p_business_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_service_type public.order_service_type,
  p_channel public.order_channel,
  p_requested_date date,
  p_items jsonb,
  p_requested_time time default null,
  p_payment_preference public.order_payment_preference default 'on_handover',
  p_delivery_address text default null,
  p_notes text default null,
  p_update_guest_name boolean default false,
  p_idempotency_key uuid default null,
  p_is_asap boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_line_quantity constant integer := 50;
  c_max_order_quantity constant integer := 100;
  c_max_lines constant integer := 50;
  c_max_address_length constant integer := 300;
  c_max_notes_length constant integer := 500;
  c_rate_window constant interval := interval '10 minutes';
  c_rate_phone_limit constant integer := 3;
  c_rate_business_limit constant integer := 120;

  v_settings public.business_settings%rowtype;
  v_slot_error text;
  v_is_privileged boolean;
  v_existing record;
  v_payload_hash text;
  v_max_line numeric;
  v_total_quantity numeric;
  v_phone_key text;
  v_business_key text;
  v_guest_result jsonb;
  v_guest_id uuid;
  v_name_mismatch boolean;
  v_submitted_name text;
  v_order_number integer;
  v_subtotal integer := 0;
  v_total_amount integer := 0;
  v_expected_product_count integer;
  v_actual_product_count integer := 0;
  v_order public.orders%rowtype;
  v_item record;
  v_order_items_to_insert jsonb := '[]'::jsonb;
begin
  -- 1. Validate business exists
  if not exists (select 1 from public.businesses where id = p_business_id) then
    raise exception 'BUSINESS_NOT_FOUND: business % not found', p_business_id using errcode = 'P0002';
  end if;

  -- 2. Validate channel & caller privileges
  if p_channel is null then
    raise exception 'INVALID_CHANNEL: p_channel is required' using errcode = '22023';
  end if;

  v_is_privileged := coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or public.is_business_member(p_business_id);

  if p_channel <> 'storefront' and not v_is_privileged then
    raise exception 'UNAUTHORIZED_CHANNEL: channel % requires business membership or service_role', p_channel using errcode = '42501';
  end if;

  -- 4. Input shape and length limits (all channels)
  if p_guest_phone is null or p_guest_phone !~ '^\+[1-9]\d{6,14}$' then
    raise exception 'INVALID_GUEST_PHONE: phone must be in E.164 format' using errcode = '22023';
  end if;

  if p_notes is not null and char_length(p_notes) > c_max_notes_length then
    raise exception 'INVALID_NOTES: notes must not exceed 500 characters' using errcode = '22023';
  end if;

  if p_delivery_address is not null and char_length(p_delivery_address) > c_max_address_length then
    raise exception 'INVALID_DELIVERY_ADDRESS: delivery address must not exceed 300 characters' using errcode = '22023';
  end if;

  if p_service_type = 'delivery' then
    if p_delivery_address is null or char_length(trim(p_delivery_address)) = 0 then
      raise exception 'INVALID_DELIVERY_ADDRESS: delivery address is required for delivery orders' using errcode = '22023';
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ORDER_ITEMS: p_items must be a non-empty JSON array' using errcode = '22023';
  end if;

  if p_channel = 'storefront' and jsonb_array_length(p_items) > c_max_lines then
    raise exception 'MAX_LINES_EXCEEDED: an order may contain at most % lines', c_max_lines using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) elem
    where jsonb_typeof(elem) <> 'object'
       or elem->>'product_id' is null and elem->>'productId' is null
  ) then
    raise exception 'INVALID_ORDER_ITEMS: product_id is required for every item' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) elem
    where coalesce(elem->>'product_id', elem->>'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'INVALID_ORDER_ITEMS: product_id must be a uuid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) elem
    where coalesce(elem->>'quantity', elem->>'qty') is null
       or coalesce(elem->>'quantity', elem->>'qty') !~ '^[0-9]{1,9}$'
       or coalesce(elem->>'quantity', elem->>'qty')::numeric < 1
  ) then
    raise exception 'INVALID_ITEM_QUANTITY: item quantity must be a whole number of at least 1' using errcode = '22023';
  end if;

  -- 4b. Idempotent replay: the same (business, key) returns the original order, provided the
  --     payload is the same. Serialized per key so two concurrent retries cannot both create
  --     an order. Runs after input validation (the payload hash needs well-formed items).
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtext('place_order_idem:' || p_business_id::text || ':' || p_idempotency_key::text));

    v_payload_hash := encode(
      sha256(
        convert_to(
          jsonb_build_object(
            'items', (
              select jsonb_agg(jsonb_build_object('product_id', t.product_id, 'quantity', t.quantity) order by t.product_id)
              from (
                select
                  coalesce(elem->>'product_id', elem->>'productId')::uuid as product_id,
                  sum(coalesce(elem->>'quantity', elem->>'qty')::numeric) as quantity
                from jsonb_array_elements(p_items) elem
                group by coalesce(elem->>'product_id', elem->>'productId')::uuid
              ) t
            ),
            'service_type', p_service_type,
            'requested_date', p_requested_date,
            'requested_time', coalesce(p_requested_time::text, ''),
            'payment_preference', p_payment_preference,
            'is_asap', coalesce(p_is_asap, false),
            'phone', p_guest_phone
          )::text,
          'UTF8'
        )
      ),
      'hex'
    );

    select o.id, o.order_number, o.tracking_token, o.submitted_name, o.total_amount,
           o.idempotency_payload_hash, g.phone as guest_phone
    into v_existing
    from public.orders o
    join public.guests g on g.id = o.guest_id
    where o.business_id = p_business_id
      and o.idempotency_key = p_idempotency_key;

    if found then
      if v_existing.guest_phone is distinct from p_guest_phone
         or (v_existing.idempotency_payload_hash is not null
             and v_existing.idempotency_payload_hash <> v_payload_hash) then
        raise exception 'INVALID_IDEMPOTENCY_KEY: key was already used for a different order' using errcode = '22023';
      end if;
      return jsonb_build_object(
        'order_id', v_existing.id,
        'order_number', v_existing.order_number,
        'tracking_token', v_existing.tracking_token,
        'submitted_name', v_existing.submitted_name,
        'total_amount', v_existing.total_amount,
        'replayed', true
      );
    end if;
  end if;

  -- 5. Retrieve business settings
  select * into v_settings
  from public.business_settings
  where business_id = p_business_id;

  if not found then
    raise exception 'BUSINESS_SETTINGS_NOT_FOUND: settings for business % not found', p_business_id using errcode = 'P0002';
  end if;

  -- 6. Storefront-specific checks
  if p_channel = 'storefront' then
    if v_settings.accepting_orders is not true then
      raise exception 'ORDERS_NOT_ACCEPTED: business % is currently not accepting orders', p_business_id using errcode = 'P0004';
    end if;

    if p_service_type = 'pickup' and coalesce((v_settings.service_types->>'pickup')::boolean, false) is false then
      raise exception 'SERVICE_TYPE_NOT_AVAILABLE: pickup is not available' using errcode = '22023';
    elsif p_service_type = 'delivery' and coalesce((v_settings.service_types->>'delivery')::boolean, false) is false then
      raise exception 'SERVICE_TYPE_NOT_AVAILABLE: delivery is not available' using errcode = '22023';
    elsif p_service_type = 'dine-in' and coalesce((v_settings.service_types->>'dineIn')::boolean, (v_settings.service_types->>'dine-in')::boolean, false) is false then
      raise exception 'SERVICE_TYPE_NOT_AVAILABLE: dine-in is not available' using errcode = '22023';
    end if;

    -- Slot rules (#373/#374): booking window [today, today + 30] in the business timezone,
    -- ASAP only while open, scheduled slots on open days/times. Mirrors validateSlot in
    -- src/domain/opening-hours.ts. Null hours = no hours check (window still applies).
    -- Called with the first 7 args only so later optional params keep their defaults.
    v_slot_error := public.slot_error(
      v_settings.weekly_hours,
      v_settings.hours_exceptions,
      v_settings.timezone,
      now(),
      p_requested_date,
      p_requested_time,
      coalesce(p_is_asap, false)
    );

    if v_slot_error is not null then
      raise exception 'SLOT_INVALID: %', v_slot_error using errcode = '22023';
    end if;

    if p_requested_time is not null and extract(second from p_requested_time) <> 0 then
      raise exception 'INVALID_REQUESTED_TIME: requested_time must be a whole minute' using errcode = '22023';
    end if;

    -- on_handover is allowed when cash OR card is enabled; the others map to the same-named method.
    if p_payment_preference = 'on_handover' then
      if not (
        coalesce((v_settings.payment_methods ->> 'cash')::boolean, true)
        or coalesce((v_settings.payment_methods ->> 'card')::boolean, false)
      ) then
        raise exception 'INVALID_PAYMENT_PREFERENCE: % is not an enabled payment method', p_payment_preference using errcode = '22023';
      end if;
    elsif not coalesce((v_settings.payment_methods ->> p_payment_preference::text)::boolean, true) then
      raise exception 'INVALID_PAYMENT_PREFERENCE: % is not an enabled payment method', p_payment_preference using errcode = '22023';
    end if;

    -- Quantity caps on the per-product totals (duplicate lines are merged, as the app does).
    select max(line_qty), sum(line_qty)
    into v_max_line, v_total_quantity
    from (
      select sum(coalesce(elem->>'quantity', elem->>'qty')::numeric) as line_qty
      from jsonb_array_elements(p_items) elem
      group by coalesce(elem->>'product_id', elem->>'productId')::uuid
    ) per_product;

    if v_max_line > c_max_line_quantity then
      raise exception 'MAX_LINE_QUANTITY_EXCEEDED: at most % per product', c_max_line_quantity using errcode = '22023';
    end if;

    if v_total_quantity > c_max_order_quantity then
      raise exception 'MAX_ORDER_QUANTITY_EXCEEDED: at most % items per order', c_max_order_quantity using errcode = '22023';
    end if;

    -- 7. Rate limits for anonymous callers. The attempt rows are written in this
    --    transaction, so a rejected order does not consume the allowance.
    if not v_is_privileged then
      v_phone_key := public.rate_limit_key(p_business_id, p_guest_phone);
      v_business_key := public.rate_limit_key(p_business_id, '');

      -- Per phone first (takes that phone's advisory lock), then the lock-free business ceiling.
      if public.rate_limit_is_exceeded('order_phone', v_phone_key, c_rate_phone_limit, c_rate_window, true) then
        raise exception 'RATE_LIMITED: too many orders, try again later' using errcode = 'P0006';
      end if;

      if public.rate_limit_is_exceeded('order_business', v_business_key, c_rate_business_limit, c_rate_window, false) then
        raise exception 'RATE_LIMITED: too many orders, try again later' using errcode = 'P0006';
      end if;

      perform public.rate_limit_record('order_phone', v_phone_key);
      perform public.rate_limit_record('order_business', v_business_key);
    end if;
  end if;

  -- 8. Count expected distinct products in p_items
  select count(distinct coalesce(elem->>'product_id', elem->>'productId')::uuid)
  into v_expected_product_count
  from jsonb_array_elements(p_items) elem;

  -- 9. Lock products in deterministic id order (FOR UPDATE) and aggregate duplicate lines
  for v_item in
    with agg_items as (
      select
        coalesce(elem->>'product_id', elem->>'productId')::uuid as product_id,
        sum(coalesce(elem->>'quantity', elem->>'qty')::int)::integer as quantity
      from jsonb_array_elements(p_items) elem
      group by coalesce(elem->>'product_id', elem->>'productId')::uuid
    )
    select
      p.id as product_id,
      p.name as product_name,
      p.price as unit_price,
      p.stock as current_stock,
      p.visible as is_visible,
      agg.quantity as requested_quantity,
      (p.price * agg.quantity)::integer as line_total
    from agg_items agg
    join public.products p on p.id = agg.product_id and p.business_id = p_business_id
    order by p.id asc
    for update of p
  loop
    v_actual_product_count := v_actual_product_count + 1;

    if p_channel = 'storefront' and not v_item.is_visible then
      raise exception 'PRODUCT_NOT_AVAILABLE: product % is not visible on storefront', v_item.product_id using errcode = 'P0003';
    end if;

    if v_item.current_stock < v_item.requested_quantity then
      raise exception 'INSUFFICIENT_STOCK: product % has % in stock, requested %', v_item.product_id, v_item.current_stock, v_item.requested_quantity using errcode = 'P0001';
    end if;

    update public.products
    set stock = stock - v_item.requested_quantity
    where id = v_item.product_id;

    v_subtotal := v_subtotal + v_item.line_total;

    v_order_items_to_insert := v_order_items_to_insert || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_item.product_id,
        'product_name', v_item.product_name,
        'quantity', v_item.requested_quantity,
        'unit_price', v_item.unit_price,
        'total_price', v_item.line_total
      )
    );
  end loop;

  if v_actual_product_count <> v_expected_product_count then
    raise exception 'PRODUCT_NOT_FOUND: one or more products not found in business %', p_business_id using errcode = 'P0002';
  end if;

  -- 10. Storefront minimum order amount check on items subtotal (mirrors src/domain/pricing.ts)
  if p_channel = 'storefront' and coalesce(v_settings.min_order_amount, 0) > 0 then
    if v_subtotal < v_settings.min_order_amount then
      raise exception 'MINIMUM_ORDER_AMOUNT_NOT_MET: subtotal % is below minimum order amount %', v_subtotal, v_settings.min_order_amount using errcode = 'P0005';
    end if;
  end if;

  -- 11. Total: items subtotal + delivery fee for delivery orders (mirrors calculateOrderTotals)
  v_total_amount := public.order_total_cents(p_business_id, p_service_type, v_subtotal);

  -- 12. Find or create guest (blind resolution)
  v_guest_result := public.find_or_create_guest(
    p_business_id,
    p_guest_name,
    p_guest_phone,
    p_delivery_address,
    p_update_guest_name
  );
  v_guest_id := (v_guest_result->>'guestId')::uuid;
  v_name_mismatch := (v_guest_result->>'nameMismatch')::boolean;
  v_submitted_name := case when v_name_mismatch then regexp_replace(trim(p_guest_name), '\s+', ' ', 'g') else null end;

  -- 13. Allocate sequential order number scoped to business via advisory lock
  perform pg_advisory_xact_lock(hashtext('order_number:' || p_business_id::text));
  select coalesce(max(order_number), 0) + 1
  into v_order_number
  from public.orders
  where business_id = p_business_id;

  -- 14. Insert order
  insert into public.orders (
    business_id,
    order_number,
    guest_id,
    submitted_name,
    service_type,
    channel,
    status,
    paid,
    payment_preference,
    requested_date,
    requested_time,
    total_amount,
    notes,
    delivery_address,
    idempotency_key,
    idempotency_payload_hash
  ) values (
    p_business_id,
    v_order_number,
    v_guest_id,
    v_submitted_name,
    p_service_type,
    p_channel,
    'NEW',
    'unpaid',
    p_payment_preference,
    p_requested_date,
    p_requested_time,
    v_total_amount,
    p_notes,
    p_delivery_address,
    p_idempotency_key,
    case when p_idempotency_key is not null then v_payload_hash end
  )
  returning * into v_order;

  -- 15. Insert snapshot order items
  insert into public.order_items (
    order_id,
    business_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    total_price
  )
  select
    v_order.id,
    p_business_id,
    (item->>'product_id')::uuid,
    item->>'product_name',
    (item->>'quantity')::integer,
    (item->>'unit_price')::integer,
    (item->>'total_price')::integer
  from jsonb_array_elements(v_order_items_to_insert) item;

  -- 16. Return sanitized order result without internal guest_id
  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'tracking_token', v_order.tracking_token,
    'submitted_name', v_submitted_name,
    'total_amount', v_total_amount,
    'replayed', false
  );
end;
$$;

revoke all on function public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid, boolean) from public;
grant execute on function public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid, boolean) to anon, authenticated, service_role;

reset lock_timeout;
