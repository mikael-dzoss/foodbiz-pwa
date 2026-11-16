-- ============================================================================
-- Migration: 20260101000005_replace_order_items.sql (#122 / M12)
-- Description: Transactional atomic order items replacement for authenticated
--              business members and service_role. Replaces HTTP delete-then-insert.
-- ============================================================================

create or replace function public.replace_order_items(
  p_business_id uuid,
  p_order_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
begin
  -- 1. Authorization check: caller must be a member of the target business or service_role
  if not (auth.role() = 'service_role' or public.is_business_member(p_business_id)) then
    raise exception 'permission denied for replace_order_items' using errcode = '42501';
  end if;

  -- 2. Verify order exists and belongs to target business
  if not exists (
    select 1 from public.orders
    where id = p_order_id and business_id = p_business_id
  ) then
    raise exception 'ORDER_NOT_FOUND: order % not found for business %', p_order_id, p_business_id using errcode = 'P0002';
  end if;

  -- 3. Delete existing items atomically
  delete from public.order_items
  where business_id = p_business_id
    and order_id = p_order_id;

  -- 4. Insert new items from jsonb array
  if p_items is not null and jsonb_array_length(p_items) > 0 then
    for v_item in select * from jsonb_array_elements(p_items) loop
      insert into public.order_items (
        id,
        order_id,
        business_id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price
      ) values (
        coalesce((v_item->>'id')::uuid, gen_random_uuid()),
        p_order_id,
        p_business_id,
        (v_item->>'product_id')::uuid,
        coalesce(v_item->>'product_name', v_item->>'productName', 'Item'),
        coalesce((v_item->>'quantity')::integer, 1),
        coalesce((v_item->>'unit_price')::integer, (v_item->>'unitPrice')::integer, 0),
        coalesce((v_item->>'total_price')::integer, (v_item->>'totalPrice')::integer, 0)
      );
    end loop;
  end if;
end;
$$;

revoke all on function public.replace_order_items(uuid, uuid, jsonb) from public, anon;
grant execute on function public.replace_order_items(uuid, uuid, jsonb) to authenticated, service_role;
