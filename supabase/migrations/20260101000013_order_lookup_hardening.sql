-- ============================================================================
-- Migration: 20260101000013_order_lookup_hardening.sql
-- Description: Harden the two anonymous order-tracking RPCs.
--
--   * storefront_order_tracking_token(business, order number, phone): counts FAILED
--     lookups per hashed (business, phone) and refuses after 5 misses in 10 minutes
--     (LOOKUP_RATE_LIMIT_PHONE_MAX_REQUESTS / RATE_LIMIT_WINDOW_MS in
--     src/domain/anti-abuse.ts). Without this, anyone who knows a phone number could
--     enumerate sequential order numbers by calling the RPC directly.
--     When limited it RAISES `RATE_LIMITED` (P0006) instead of returning NULL. The
--     check runs before the lookup, so the answer is identical whether or not the
--     order exists (no oracle), and a legitimate customer who is blocked is told so
--     instead of being shown a misleading "not found". The function is now VOLATILE
--     (it records misses); supabase-js rpc() uses POST, so this is transparent.
--   * get_order_by_tracking_token(token): returns an explicit column list for items
--     (product_name, quantity, unit_price, total_price: what the tracking and
--     confirmation UI use) instead of to_jsonb(order_items), which leaked ids, the
--     business id and any column added later.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   re-create both functions as in 20260101000001_rls_policies.sql.
-- ============================================================================

create or replace function public.get_order_by_tracking_token(p_tracking_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
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
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.tracking_token = p_tracking_token
  group by o.id;
$$;

create or replace function public.storefront_order_tracking_token(
  p_business_id uuid,
  p_order_number integer,
  p_phone text
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c_limit constant integer := 5;
  c_window constant interval := interval '10 minutes';
  v_key text;
  v_token text;
begin
  v_key := public.rate_limit_key(p_business_id, trim(coalesce(p_phone, '')));

  if public.rate_limit_is_exceeded('lookup_phone', v_key, c_limit, c_window) then
    raise exception 'RATE_LIMITED: too many lookups, try again later' using errcode = 'P0006';
  end if;

  select o.tracking_token
  into v_token
  from public.orders o
  join public.guests g on o.guest_id = g.id
  where o.business_id = p_business_id
    and o.order_number = p_order_number
    and g.phone = p_phone
  limit 1;

  if v_token is null then
    perform public.rate_limit_record('lookup_phone', v_key);
  end if;

  return v_token;
end;
$$;

revoke all on function public.storefront_order_tracking_token(uuid, integer, text) from public;
grant execute on function public.storefront_order_tracking_token(uuid, integer, text) to anon, authenticated, service_role;
