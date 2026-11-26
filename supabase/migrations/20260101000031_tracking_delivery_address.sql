-- ============================================================================
-- Migration: 20260101000031_tracking_delivery_address.sql
-- Description: Return the delivery address from get_order_by_tracking_token
--              when (and only when) the order is a delivery order (#352).
--
--   For pickup (and legacy dine-in) orders, 'delivery_address' is returned as
--   null even if a value is stored on the row. No other column is added, no
--   new public read path is created, and RLS policies are unchanged.
--   Runs inside the CLI's per-file transaction.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   re-create public.get_order_by_tracking_token(text) as in
--   20260101000015_order_lookup_hardening.sql.
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

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
  left join public.order_items oi on oi.order_id = o.id
  where o.tracking_token = p_tracking_token
  group by o.id;
$$;

revoke all on function public.get_order_by_tracking_token(text) from public;
grant execute on function public.get_order_by_tracking_token(text) to anon, authenticated, service_role;

reset lock_timeout;
