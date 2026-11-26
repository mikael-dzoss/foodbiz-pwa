-- ============================================================================
-- Migration: 20260101000036_pickup_location_orders.sql
-- Description: Orders can be collected at a relay pickup location (#386, #387 data part).
--
--   orders gains `pickup_location_id` (tenant-safe composite FK to pickup_locations,
--   `on delete set null (pickup_location_id)` so deleting a location keeps the order),
--   `pickup_location_name` / `pickup_location_address` (snapshot taken at placement; address is
--   "<address>, <postcode>"), `pickup_fee_cents` (the relay fee stored on the order, 0 by
--   default), and `orders_pickup_location_consistency` (non-pickup orders must have a null
--   location and zero fee). Orders without a location still mean the shop.
--   `idx_orders_pickup_location_id` is created in this transactional migration (not
--   CONCURRENTLY, which cannot run inside a transaction) because `orders` is small at v0.9.
--
--   * public.pickup_schedule_hours(business weekly, business exceptions, location weekly):
--     SQL mirror of pickupScheduleFor in src/domain/pickup-location.ts. No location hours =
--     the business schedule unchanged; otherwise the location weekly hours with every weekday
--     the business closes emptied, and only the business CLOSED exceptions (empty ranges).
--   * public.order_total_cents gains a trailing `p_pickup_fee integer default 0`; the old
--     3-argument signature is dropped first. replace_order_items passes the stored fee so item
--     edits keep it in the total.
--   * place_order gains a trailing `p_pickup_location_id uuid default null` (old 14-argument
--     overload dropped, no stale overload). Body = 20260101000034 plus: the location must exist,
--     belong to the business and be active (INVALID_PICKUP_LOCATION; also when the order is not
--     pickup); storefront pickup needs at least one option (PICKUP_NOT_AVAILABLE), a choice when
--     several relays and no shop pickup are offered (PICKUP_LOCATION_REQUIRED), and a lone relay
--     is selected automatically; location reads take `FOR SHARE OF pl` to prevent concurrent
--     deactivate/delete/fee updates before the order insert; relay slots use
--     pickup_schedule_hours. The location id is part of the idempotency payload only when set, so
--     payloads without one hash exactly as in 034; an idempotency key must be retried with the
--     same input (retrying a null-location call by adding the auto-selected relay id hashes
--     differently and raises INVALID_IDEMPOTENCY_KEY, by design).
--   * get_order_by_tracking_token returns pickup_location_name (null = the shop) and
--     pickup_location_address (the shop address when no relay) for pickup orders.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid, boolean, uuid);
--   -- re-create place_order from 20260101000034_place_order_slot_rules.sql and restate its grants;
--   drop function if exists public.order_total_cents(uuid, public.order_service_type, integer, integer);
--   -- re-create order_total_cents(uuid, order_service_type, integer) from 20260101000024, then
--   -- replace_order_items from 20260101000026 and get_order_by_tracking_token from 20260101000031;
--   drop function if exists public.pickup_schedule_hours(jsonb, jsonb, jsonb);
--   drop index if exists public.idx_orders_pickup_location_id;
--   alter table public.orders drop constraint if exists orders_business_pickup_location_fkey;
--   alter table public.orders drop constraint if exists orders_pickup_location_consistency;
--   alter table public.orders drop column if exists pickup_fee_cents, drop column if exists pickup_location_address,
--     drop column if exists pickup_location_name, drop column if exists pickup_location_id;
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. orders columns, consistency check, tenant-safe FK, index
-- ----------------------------------------------------------------------------
alter table public.orders add column pickup_location_id uuid null;
alter table public.orders add column pickup_location_name text null;
alter table public.orders add column pickup_location_address text null;
alter table public.orders
  add column pickup_fee_cents integer not null default 0
    constraint orders_pickup_fee_cents_nonneg check (pickup_fee_cents >= 0);

-- Add both constraints NOT VALID and validate them explicitly (all pre-existing rows have
-- pickup_location_id IS NULL and pickup_fee_cents = 0).
alter table public.orders
  add constraint orders_pickup_location_consistency
  check (service_type = 'pickup' or (pickup_location_id is null and pickup_fee_cents = 0))
  not valid;

alter table public.orders
  add constraint orders_business_pickup_location_fkey
  foreign key (business_id, pickup_location_id)
  references public.pickup_locations (business_id, id)
  on delete set null (pickup_location_id)
  not valid;

alter table public.orders validate constraint orders_pickup_location_consistency;
alter table public.orders validate constraint orders_business_pickup_location_fkey;

create index idx_orders_pickup_location_id
  on public.orders (pickup_location_id)
  where pickup_location_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Relay schedule (mirror of pickupScheduleFor)
-- ----------------------------------------------------------------------------
create or replace function public.pickup_schedule_hours(
  p_business_weekly jsonb,
  p_business_exceptions jsonb,
  p_location_weekly jsonb
)
returns table (weekly jsonb, exceptions jsonb)
language sql
immutable
set search_path = ''
as $$
  select
    case
      when p_location_weekly is null then p_business_weekly
      else (
        select jsonb_object_agg(
          d,
          case
            when p_business_weekly is not null
              and jsonb_typeof(p_business_weekly -> d) = 'array'
              and jsonb_array_length(p_business_weekly -> d) = 0
            then '[]'::jsonb
            else coalesce(p_location_weekly -> d, '[]'::jsonb)
          end
        )
        from unnest(array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) as d
      )
    end,
    case
      when p_location_weekly is null then p_business_exceptions
      else coalesce(
        (
          select jsonb_agg(e.ex order by e.ord)
          from jsonb_array_elements(p_business_exceptions) with ordinality as e(ex, ord)
          where jsonb_typeof(e.ex -> 'ranges') = 'array'
            and jsonb_array_length(e.ex -> 'ranges') = 0
        ),
        '[]'::jsonb
      )
    end;
$$;

revoke all on function public.pickup_schedule_hours(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.pickup_schedule_hours(jsonb, jsonb, jsonb) to service_role;

-- ----------------------------------------------------------------------------
-- 3. order_total_cents with the pickup fee
-- ----------------------------------------------------------------------------
drop function if exists public.order_total_cents(uuid, public.order_service_type, integer);

create function public.order_total_cents(
  p_business_id uuid,
  p_service_type public.order_service_type,
  p_subtotal integer,
  p_pickup_fee integer default 0
)
returns integer
language sql
stable
set search_path = ''
as $$
  select p_subtotal
    + case
        when p_service_type = 'delivery' then coalesce(
          (select greatest(0, s.delivery_fee) from public.business_settings s where s.business_id = p_business_id),
          0
        )
        else 0
      end
    + case
        when p_service_type = 'pickup' then greatest(0, coalesce(p_pickup_fee, 0))
        else 0
      end;
$$;

revoke all on function public.order_total_cents(uuid, public.order_service_type, integer, integer)
  from public, anon, authenticated;
grant execute on function public.order_total_cents(uuid, public.order_service_type, integer, integer)
  to service_role;

-- ----------------------------------------------------------------------------
-- 4. replace_order_items keeps the stored pickup fee
-- ----------------------------------------------------------------------------
create or replace function public.replace_order_items(
  p_business_id uuid,
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_lines constant integer := 100;
  c_max_quantity constant integer := 9999;
  v_order public.orders%rowtype;
  v_line record;
  v_expected_products integer;
  v_found_products integer := 0;
  v_subtotal bigint := 0;
  v_unit_price integer;
  v_line_total bigint;
  v_new_items jsonb := '[]'::jsonb;
  v_orphan_total bigint;
  v_fee integer;
begin
  if not (coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for replace_order_items' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'INVALID_ORDER_ITEMS: p_items must be a non-empty JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) > c_max_lines then
    raise exception 'INVALID_ORDER_ITEMS: at most % lines', c_max_lines using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) elem
    where jsonb_typeof(elem) <> 'object'
       or coalesce(elem->>'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) then
    raise exception 'INVALID_ORDER_ITEMS: product_id (uuid) is required for every item' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) elem
    where case
            when coalesce(elem->>'quantity', '') ~ '^[0-9]{1,4}$' then (elem->>'quantity')::integer < 1
            else true
          end
  ) then
    raise exception 'INVALID_ITEM_QUANTITY: quantity must be a whole number between 1 and %', c_max_quantity using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND: order % not found for business %', p_order_id, p_business_id using errcode = 'P0002';
  end if;

  if v_order.status in ('COMPLETED', 'CANCELLED') or v_order.paid in ('paid', 'refunded') then
    raise exception 'ORDER_STATE_CONFLICT: order items cannot be changed once the order is % (paid: %)', v_order.status, v_order.paid using errcode = 'P0007';
  end if;

  select count(distinct (elem->>'product_id')::uuid)
  into v_expected_products
  from jsonb_array_elements(p_items) elem;

  -- Lock every product involved (new and old lines) in id order, then apply the stock delta.
  for v_line in
    with new_lines as (
      select (elem->>'product_id')::uuid as product_id,
             sum((elem->>'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) elem
      group by 1
    ),
    old_lines as (
      select oi.product_id,
             sum(oi.quantity)::integer as quantity,
             (array_agg(oi.unit_price order by oi.created_at, oi.id))[1] as unit_price,
             (array_agg(oi.product_name order by oi.created_at, oi.id))[1] as product_name
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.business_id = p_business_id
        and oi.product_id is not null
      group by oi.product_id
    ),
    involved as (
      select product_id from new_lines
      union
      select product_id from old_lines
    )
    select
      p.id as product_id,
      p.name as current_name,
      p.price as current_price,
      p.stock as current_stock,
      coalesce(n.quantity, 0) as new_quantity,
      coalesce(o.quantity, 0) as old_quantity,
      o.unit_price as old_unit_price,
      o.product_name as old_name
    from involved i
    join public.products p on p.id = i.product_id and p.business_id = p_business_id
    left join new_lines n on n.product_id = p.id
    left join old_lines o on o.product_id = p.id
    order by p.id asc
    for update of p
  loop
    if v_line.new_quantity > 0 then
      v_found_products := v_found_products + 1;

      if v_line.new_quantity - v_line.old_quantity > v_line.current_stock then
        raise exception 'INSUFFICIENT_STOCK: product % has % in stock, % more requested', v_line.product_id, v_line.current_stock, v_line.new_quantity - v_line.old_quantity using errcode = 'P0001';
      end if;

      if v_line.old_quantity > 0 then
        v_unit_price := v_line.old_unit_price;
      else
        v_unit_price := v_line.current_price;
      end if;
      v_line_total := v_unit_price::bigint * v_line.new_quantity;
      v_subtotal := v_subtotal + v_line_total;

      v_new_items := v_new_items || jsonb_build_array(jsonb_build_object(
        'product_id', v_line.product_id,
        'product_name', case when v_line.old_quantity > 0 then v_line.old_name else v_line.current_name end,
        'quantity', v_line.new_quantity,
        'unit_price', v_unit_price,
        'total_price', v_line_total
      ));
    end if;

    if v_line.new_quantity <> v_line.old_quantity then
      update public.products
      set stock = stock - (v_line.new_quantity - v_line.old_quantity)
      where id = v_line.product_id;
    end if;
  end loop;

  if v_found_products <> v_expected_products then
    raise exception 'PRODUCT_NOT_FOUND: one or more products not found in business %', p_business_id using errcode = 'P0002';
  end if;

  -- Lines whose product was hard-deleted (product_id is null) cannot be re-priced or edited:
  -- keep them untouched and count them in the total.
  select coalesce(sum(total_price), 0) into v_orphan_total
  from public.order_items
  where order_id = p_order_id and business_id = p_business_id and product_id is null;
  v_subtotal := v_subtotal + v_orphan_total;

  if v_subtotal > 2000000000 then
    raise exception 'INVALID_ORDER_ITEMS: order total is too large' using errcode = '22023';
  end if;

  -- The cap covers subtotal + delivery/pickup fee (the sum is what order_total_cents adds in int).
  v_fee := public.order_total_cents(p_business_id, v_order.service_type, 0, v_order.pickup_fee_cents);
  if v_subtotal + v_fee > 2000000000 then
    raise exception 'INVALID_ORDER_ITEMS: order total is too large' using errcode = '22023';
  end if;

  delete from public.order_items
  where business_id = p_business_id
    and order_id = p_order_id
    and product_id is not null;

  insert into public.order_items (
    order_id, business_id, product_id, product_name, quantity, unit_price, total_price
  )
  select
    p_order_id,
    p_business_id,
    (item->>'product_id')::uuid,
    item->>'product_name',
    (item->>'quantity')::integer,
    (item->>'unit_price')::integer,
    (item->>'total_price')::integer
  from jsonb_array_elements(v_new_items) item;

  update public.orders
  set total_amount = public.order_total_cents(p_business_id, v_order.service_type, v_subtotal::integer, v_order.pickup_fee_cents)
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;

  return jsonb_build_object('order_id', v_order.id, 'total_amount', v_order.total_amount);
end;
$$;

revoke all on function public.replace_order_items(uuid, uuid, jsonb) from public, anon;
grant execute on function public.replace_order_items(uuid, uuid, jsonb) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. place_order with p_pickup_location_id
-- ----------------------------------------------------------------------------
drop function if exists public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid, boolean);

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
  p_is_asap boolean default false,
  p_pickup_location_id uuid default null
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
  v_location public.pickup_locations%rowtype;
  v_location_id uuid;
  v_pickup_fee integer := 0;
  v_pickup_name text;
  v_pickup_address text;
  v_active_relays integer;
  v_sched_weekly jsonb;
  v_sched_exceptions jsonb;
  v_is_privileged boolean;
  v_existing record;
  v_payload jsonb;
  v_payload_hash text;
  v_legacy_hash text;
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

    v_payload := jsonb_build_object(
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
    ) || case
      -- Only present when a location was chosen, so a payload without one hashes exactly as in
      -- 034 (in-flight retries of orders placed before this migration keep replaying). Callers
      -- must retry an idempotency key with the same input (adding an auto-selected relay id
      -- hashes differently and raises INVALID_IDEMPOTENCY_KEY, by design).
      when p_pickup_location_id is not null then jsonb_build_object('pickup_location_id', p_pickup_location_id)
      else '{}'::jsonb
    end;
    v_payload_hash := encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex');
    -- Pre-034 orders stored a hash without is_asap; jsonb key order is canonical, so removing the key reproduces it.
    v_legacy_hash := encode(sha256(convert_to((v_payload - 'is_asap')::text, 'UTF8')), 'hex');

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
             and v_existing.idempotency_payload_hash <> v_payload_hash
             and not (v_existing.idempotency_payload_hash = v_legacy_hash
                      and coalesce(p_is_asap, false) is false)) then
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

  -- 5b. Pickup location (all channels): must exist, belong to this business and be active;
  --     only pickup orders can carry one. Name, address and fee are snapshotted below.
  if p_pickup_location_id is not null then
    if p_service_type <> 'pickup' then
      raise exception 'INVALID_PICKUP_LOCATION: only pickup orders can have a pickup location' using errcode = '22023';
    end if;

    select * into v_location
    from public.pickup_locations pl
    where pl.id = p_pickup_location_id
      and pl.business_id = p_business_id
      and pl.is_active
    for share of pl;

    if not found then
      raise exception 'INVALID_PICKUP_LOCATION: pickup location % is not available', p_pickup_location_id using errcode = '22023';
    end if;

    v_location_id := v_location.id;
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

    -- Pickup options (#386): the shop (when enabled) plus the active relay locations. A null
    -- location means the shop; several options without a valid choice are refused, and a single
    -- relay (shop pickup disabled) is selected automatically.
    if p_service_type = 'pickup' then
      select count(*) into v_active_relays
      from public.pickup_locations pl
      where pl.business_id = p_business_id and pl.is_active;

      if (case when v_settings.shop_pickup_enabled then 1 else 0 end) + v_active_relays = 0 then
        raise exception 'PICKUP_NOT_AVAILABLE: no pickup option is available' using errcode = '22023';
      end if;

      if v_location_id is null and not v_settings.shop_pickup_enabled then
        if v_active_relays = 1 then
          select * into v_location
          from public.pickup_locations pl
          where pl.business_id = p_business_id and pl.is_active
          order by pl.sort_order, pl.created_at
          limit 1
          for share of pl;
          if not found then
            raise exception 'PICKUP_NOT_AVAILABLE: no pickup option is available' using errcode = '22023';
          end if;
          v_location_id := v_location.id;
        else
          raise exception 'PICKUP_LOCATION_REQUIRED: choose a pickup location' using errcode = '22023';
        end if;
      end if;
    end if;

    -- Slot rules (#373/#374): booking window [today, today + 30] in the business timezone,
    -- ASAP only while open, scheduled slots on open days/times. Mirrors validateSlot in
    -- src/domain/opening-hours.ts. Null hours = no hours check (window still applies).
    -- Called with the first 7 args only so later optional params keep their defaults.
    -- A relay follows its own weekly hours, minus the business closed days and closures (#386).
    v_sched_weekly := v_settings.weekly_hours;
    v_sched_exceptions := v_settings.hours_exceptions;
    if v_location_id is not null then
      select s.weekly, s.exceptions into v_sched_weekly, v_sched_exceptions
      from public.pickup_schedule_hours(v_settings.weekly_hours, v_settings.hours_exceptions, v_location.weekly_hours) s;
    end if;

    v_slot_error := public.slot_error(
      v_sched_weekly,
      v_sched_exceptions,
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

  -- 11. Total: items subtotal + delivery fee (delivery) + relay fee (pickup), mirrors calculateOrderTotals
  if v_location_id is not null then
    v_pickup_fee := v_location.fee_cents;
    v_pickup_name := v_location.name;
    v_pickup_address := v_location.address || ', ' || v_location.postcode;
  end if;

  v_total_amount := public.order_total_cents(p_business_id, p_service_type, v_subtotal, v_pickup_fee);

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
    idempotency_payload_hash,
    pickup_location_id,
    pickup_location_name,
    pickup_location_address,
    pickup_fee_cents
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
    case when p_idempotency_key is not null then v_payload_hash end,
    v_location_id,
    v_pickup_name,
    v_pickup_address,
    v_pickup_fee
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

revoke all on function public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid, boolean, uuid) from public;
grant execute on function public.place_order(uuid, text, text, public.order_service_type, public.order_channel, date, jsonb, time, public.order_payment_preference, text, text, boolean, uuid, boolean, uuid) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Tracking RPC returns where to collect
-- ----------------------------------------------------------------------------
create or replace function public.get_order_by_tracking_token(p_tracking_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'business_id', o.business_id,
      'order_number', o.order_number,
      'service_type', o.service_type,
      'status', o.status,
      'paid', o.paid,
      'payment_preference', o.payment_preference,
      'cancellation_reason', o.cancellation_reason,
      'requested_date', o.requested_date,
      'requested_time', o.requested_time,
      'total_amount', o.total_amount,
      'tracking_token', o.tracking_token,
      'delivery_address', case when o.service_type = 'delivery' then o.delivery_address else null end,
      'pickup_location_name', case when o.service_type = 'pickup' then o.pickup_location_name else null end,
      'pickup_location_address', case
        when o.service_type = 'pickup' then coalesce(
          nullif(btrim(o.pickup_location_address), ''),
          nullif(btrim(b.address), '')
        )
        else null
      end,
      'created_at', o.created_at,
      'updated_at', o.updated_at
    ),
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price
        )
        order by oi.created_at, oi.id
      ) filter (where oi.id is not null),
      '[]'::jsonb
    )
  )
  from public.orders o
  join public.businesses b on b.id = o.business_id
  left join public.order_items oi on oi.order_id = o.id
  where o.tracking_token = p_tracking_token
  group by o.id, b.address;
$$;

revoke all on function public.get_order_by_tracking_token(text) from public;
grant execute on function public.get_order_by_tracking_token(text) to anon, authenticated, service_role;

reset lock_timeout;
