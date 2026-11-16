-- ============================================================================
-- Migration: 20260101000026_replace_order_items_server_side.sql
-- Description: replace_order_items no longer trusts the client. It used to insert whatever
--   names, prices and totals the caller sent (defaults 'Item' / 1 / 0), never touched
--   orders.total_amount and never adjusted stock. Now:
--     * input is [{ "product_id": uuid, "quantity": n }] only; any other key (names, prices,
--       totals) is ignored. The manager UI has no custom price or free-text line today (manual
--       orders and the order screens only deal in catalog products), so nothing is removed.
--     * every product must belong to the same business; duplicate lines are summed;
--       quantity is a whole number from 1 to 9999; at most 100 lines; at least one line.
--     * lines whose product is already on the order keep their snapshot (name and unit price at
--       the time the order was placed), new lines take the current name and price from products.
--     * stock moves by the delta (new quantity minus old quantity per product) under row locks
--       taken in id order; insufficient stock raises INSUFFICIENT_STOCK (P0001).
--     * orders.total_amount is recomputed through public.order_total_cents (same rule as
--       place_order).
--     * refused with ORDER_STATE_CONFLICT (P0007) once the order is COMPLETED or CANCELLED, or
--       is refunded: those states close the order's money and stock.
--   The return type changes (void to jsonb), so the old function is dropped first.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.replace_order_items(uuid, uuid, jsonb);
--   then re-create the version from 20260101000014 (it trusts client prices: do not).
-- ============================================================================

drop function if exists public.replace_order_items(uuid, uuid, jsonb);

create function public.replace_order_items(
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

  if v_order.status in ('COMPLETED', 'CANCELLED') or v_order.paid = 'refunded' then
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

  if v_subtotal > 2000000000 then
    raise exception 'INVALID_ORDER_ITEMS: order total is too large' using errcode = '22023';
  end if;

  delete from public.order_items
  where business_id = p_business_id
    and order_id = p_order_id;

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
  set total_amount = public.order_total_cents(p_business_id, v_order.service_type, v_subtotal::integer)
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;

  return jsonb_build_object('order_id', v_order.id, 'total_amount', v_order.total_amount);
end;
$$;

revoke all on function public.replace_order_items(uuid, uuid, jsonb) from public, anon;
grant execute on function public.replace_order_items(uuid, uuid, jsonb) to authenticated, service_role;
