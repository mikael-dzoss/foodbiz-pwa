-- ============================================================================
-- FoodBiz PWA — Order RPC Functions (#121)
-- Description: Atomic order placement, stock decrement, blind guest resolution,
--              concurrency serialization via advisory locks, and atomic cancellation
--              with stock restoration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. public.find_or_create_guest
-- ----------------------------------------------------------------------------
-- Resolves or inserts guest by (business_id, phone).
-- Preserves canonical guests.name unless updated by an authenticated business member or service_role.
-- Internal helper for place_order; revoked from anon and authenticated API callers (#121 / C2).
-- Returns: jsonb { guestId: uuid, isNew: boolean, nameMismatch: boolean }
create or replace function public.find_or_create_guest(
  p_business_id uuid,
  p_name text,
  p_phone text,
  p_address text default null,
  p_update_guest_name boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_name text;
  v_guest public.guests%rowtype;
  v_name_mismatch boolean := false;
begin
  -- Advisory lock on (business_id, phone) to serialize concurrent lookups/inserts
  perform pg_advisory_xact_lock(hashtext('guest:' || p_business_id::text || ':' || coalesce(p_phone, '')));

  -- Normalize name: trim and collapse multiple internal whitespaces to a single space
  v_clean_name := regexp_replace(trim(p_name), '\s+', ' ', 'g');

  if char_length(v_clean_name) < 2 or char_length(v_clean_name) > 50 then
    raise exception 'INVALID_GUEST_NAME: name must be between 2 and 50 characters' using errcode = '22023';
  end if;

  -- Look up existing guest in public.guests by (business_id, phone)
  select * into v_guest
  from public.guests
  where business_id = p_business_id
    and phone = p_phone
  limit 1;

  if not found then
    -- New guest record
    insert into public.guests (business_id, name, phone, address)
    values (p_business_id, v_clean_name, p_phone, p_address)
    returning * into v_guest;

    return jsonb_build_object(
      'guestId', v_guest.id,
      'isNew', true,
      'nameMismatch', false
    );
  end if;

  -- Existing guest record found
  -- Require p_update_guest_name is true and caller is business member or service_role (#121 / L2)
  if v_guest.name <> v_clean_name then
    if p_update_guest_name is true and (
      auth.role() = 'service_role'
      or public.is_business_member(p_business_id)
    ) then
      update public.guests
      set name = v_clean_name
      where id = v_guest.id;

      v_name_mismatch := false;
    else
      v_name_mismatch := true;
    end if;
  else
    v_name_mismatch := false;
  end if;

  return jsonb_build_object(
    'guestId', v_guest.id,
    'isNew', false,
    'nameMismatch', v_name_mismatch
  );
end;
$$;

revoke all on function public.find_or_create_guest(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.find_or_create_guest(uuid, text, text, text, boolean) to service_role;

-- ----------------------------------------------------------------------------
-- 2. public.place_order
-- ----------------------------------------------------------------------------
-- Atomically validates product stock, decrements stock, performs blind guest resolution,
-- allocates sequential order number, creates order and snapshot order_items.
-- Returns: jsonb { order_id, order_number, tracking_token, submitted_name, total_amount }
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
  p_update_guest_name boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.business_settings%rowtype;
  v_guest_result jsonb;
  v_guest_id uuid;
  v_name_mismatch boolean;
  v_submitted_name text;
  v_order_number integer;
  v_subtotal integer := 0;
  v_delivery_fee integer := 0;
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

  -- 2. Validate channel & caller privileges (#121 / C3)
  if p_channel is null then
    raise exception 'INVALID_CHANNEL: p_channel is required' using errcode = '22023';
  end if;

  if p_channel <> 'storefront' then
    if not (auth.role() = 'service_role' or public.is_business_member(p_business_id)) then
      raise exception 'UNAUTHORIZED_CHANNEL: channel % requires business membership or service_role', p_channel using errcode = '42501';
    end if;
  end if;

  -- 3. Retrieve business settings
  select * into v_settings
  from public.business_settings
  where business_id = p_business_id;

  if not found then
    raise exception 'BUSINESS_SETTINGS_NOT_FOUND: settings for business % not found', p_business_id using errcode = 'P0002';
  end if;

  -- 4. Storefront-specific operational checks (#121 / C3)
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

    if p_requested_date is null or p_requested_date < (current_date - 1) then
      raise exception 'INVALID_REQUESTED_DATE: requested_date cannot be in the past' using errcode = '22023';
    end if;
  end if;

  -- 5. Delivery address check (#121 / C3, H1)
  if p_service_type = 'delivery' then
    if p_delivery_address is null or char_length(trim(p_delivery_address)) = 0 then
      raise exception 'INVALID_DELIVERY_ADDRESS: delivery address is required for delivery orders' using errcode = '22023';
    end if;
  end if;

  -- 6. Notes length validation (domain limit: 500 characters, #121 / C3)
  if p_notes is not null and char_length(p_notes) > 500 then
    raise exception 'INVALID_NOTES: notes must not exceed 500 characters' using errcode = '22023';
  end if;

  -- 7. Validate items parameter
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ORDER_ITEMS: p_items must be a non-empty JSON array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) elem
    where coalesce((elem->>'quantity')::int, (elem->>'qty')::int, 0) < 1
  ) then
    raise exception 'INVALID_ITEM_QUANTITY: item quantity must be at least 1' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) elem
    where elem->>'product_id' is null and elem->>'productId' is null
  ) then
    raise exception 'INVALID_ORDER_ITEMS: product_id is required for every item' using errcode = '22023';
  end if;

  -- 8. Count expected distinct products in p_items
  select count(distinct coalesce((elem->>'product_id')::uuid, (elem->>'productId')::uuid))
  into v_expected_product_count
  from jsonb_array_elements(p_items) elem;

  -- 9. Lock products in deterministic id order (FOR UPDATE) and aggregate duplicate lines
  for v_item in
    with agg_items as (
      select
        coalesce((elem->>'product_id')::uuid, (elem->>'productId')::uuid) as product_id,
        sum(coalesce((elem->>'quantity')::int, (elem->>'qty')::int, 0))::integer as quantity
      from jsonb_array_elements(p_items) elem
      group by coalesce((elem->>'product_id')::uuid, (elem->>'productId')::uuid)
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

    -- Storefront visibility check: hidden products are purchasable only through authorized non-storefront channels
    if p_channel = 'storefront' and not v_item.is_visible then
      raise exception 'PRODUCT_NOT_AVAILABLE: product % is not visible on storefront', v_item.product_id using errcode = 'P0003';
    end if;

    -- Stock check
    if v_item.current_stock < v_item.requested_quantity then
      raise exception 'INSUFFICIENT_STOCK: product % has % in stock, requested %', v_item.product_id, v_item.current_stock, v_item.requested_quantity using errcode = 'P0001';
    end if;

    -- Decrement stock
    update public.products
    set stock = stock - v_item.requested_quantity
    where id = v_item.product_id;

    -- Accumulate items subtotal
    v_subtotal := v_subtotal + v_item.line_total;

    -- Append to items list for snapshot insertion
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

  -- 11. Compute total amount: items subtotal + delivery fee for delivery orders (mirrors calculateOrderTotals in src/domain/pricing.ts)
  v_delivery_fee := case
    when p_service_type = 'delivery' then greatest(0, coalesce(v_settings.delivery_fee, 0))
    else 0
  end;
  v_total_amount := v_subtotal + v_delivery_fee;

  -- 12. Find or create guest (blind resolution, internal call with security definer)
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

  -- 14. Insert order (including delivery_address, #121 / H1)
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
    delivery_address
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
    p_delivery_address
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

  -- 16. Return sanitized order result without internal guest_id (#121 / L1)
  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'tracking_token', v_order.tracking_token,
    'submitted_name', v_submitted_name,
    'total_amount', v_total_amount
  );
end;
$$;

revoke all on function public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean) from public;
grant execute on function public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. public.cancel_order
-- ----------------------------------------------------------------------------
-- Authenticated manager or service_role RPC to cancel an order and atomically restore inventory stock.
-- Raises error if order is completed or already cancelled.
-- Returns: jsonb { order_id, status, cancellation_reason }
create or replace function public.cancel_order(
  p_business_id uuid,
  p_order_id uuid,
  p_cancellation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  -- Authorization check: caller must be a member of the target business or service_role (#121 / M10)
  if not (auth.role() = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for cancel_order' using errcode = '42501';
  end if;

  -- Lock order row
  select * into v_order
  from public.orders
  where id = p_order_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % not found for business %', p_order_id, p_business_id using errcode = 'P0002';
  end if;

  if v_order.status = 'COMPLETED' then
    raise exception 'INVALID_STATUS_TRANSITION: cannot cancel a completed order' using errcode = '22023';
  end if;

  if v_order.status = 'CANCELLED' then
    raise exception 'INVALID_STATUS_TRANSITION: order is already cancelled' using errcode = '22023';
  end if;

  -- Restore stock atomically on public.products
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

  -- Transition order to CANCELLED
  update public.orders
  set status = 'CANCELLED',
      cancellation_reason = coalesce(p_cancellation_reason, cancellation_reason)
  where id = p_order_id
    and business_id = p_business_id
  returning * into v_order;

  return jsonb_build_object(
    'order_id', v_order.id,
    'status', 'CANCELLED',
    'cancellation_reason', v_order.cancellation_reason
  );
end;
$$;

revoke all on function public.cancel_order(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, uuid, text) to authenticated, service_role;
