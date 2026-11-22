-- ============================================================================
-- Migration: 20260101000001_rls_policies.sql
-- Description: Row Level Security (RLS) policies, membership helper functions,
--              and public security definer RPC functions for order tracking
--              and storefront featured products (#120).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.storefront_featured_products(uuid, timestamptz, timestamptz);
--   drop function if exists public.storefront_order_tracking_token(uuid, integer, text);
--   drop function if exists public.get_order_by_tracking_token(text);
--   drop policy if exists expenses_delete_authenticated on expenses;
--   drop policy if exists expenses_update_authenticated on expenses;
--   drop policy if exists expenses_insert_authenticated on expenses;
--   drop policy if exists expenses_select_authenticated on expenses;
--   drop policy if exists order_items_delete_authenticated on order_items;
--   drop policy if exists order_items_update_authenticated on order_items;
--   drop policy if exists order_items_select_authenticated on order_items;
--   drop policy if exists orders_delete_authenticated on orders;
--   drop policy if exists orders_update_authenticated on orders;
--   drop policy if exists orders_select_authenticated on orders;
--   drop policy if exists guests_delete_authenticated on guests;
--   drop policy if exists guests_update_authenticated on guests;
--   drop policy if exists guests_insert_authenticated on guests;
--   drop policy if exists guests_select_authenticated on guests;
--   drop policy if exists products_delete_authenticated on products;
--   drop policy if exists products_update_authenticated on products;
--   drop policy if exists products_insert_authenticated on products;
--   drop policy if exists products_select_authenticated on products;
--   drop policy if exists products_select_anon on products;
--   drop policy if exists product_categories_delete_authenticated on product_categories;
--   drop policy if exists product_categories_update_authenticated on product_categories;
--   drop policy if exists product_categories_insert_authenticated on product_categories;
--   drop policy if exists product_categories_select_authenticated on product_categories;
--   drop policy if exists product_categories_select_anon on product_categories;
--   drop policy if exists business_settings_delete_authenticated on business_settings;
--   drop policy if exists business_settings_update_authenticated on business_settings;
--   drop policy if exists business_settings_insert_authenticated on business_settings;
--   drop policy if exists business_settings_select_authenticated on business_settings;
--   drop policy if exists business_settings_select_anon on business_settings;
--   drop policy if exists business_members_delete_authenticated on business_members;
--   drop policy if exists business_members_update_authenticated on business_members;
--   drop policy if exists business_members_insert_authenticated on business_members;
--   drop policy if exists business_members_select_authenticated on business_members;
--   drop policy if exists businesses_delete_authenticated on businesses;
--   drop policy if exists businesses_update_authenticated on businesses;
--   drop policy if exists businesses_select_authenticated on businesses;
--   drop policy if exists businesses_select_anon on businesses;
--   drop function if exists public.is_business_owner(uuid);
--   drop function if exists public.is_business_member(uuid);
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Membership and Ownership Helper Functions
-- ----------------------------------------------------------------------------

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = target_business_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = target_business_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to anon, authenticated, service_role;

revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_owner(uuid) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Ensure Row Level Security is Enabled on All 9 Tables
-- ----------------------------------------------------------------------------

alter table businesses enable row level security;
alter table business_members enable row level security;
alter table business_settings enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table guests enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table expenses enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Row Level Security Policies
-- ----------------------------------------------------------------------------

-- Businesses
-- Anonymous users can read business public profiles (name, slug, currency, contact info)
-- for storefront discovery and branding.
create policy businesses_select_anon
  on businesses for select to anon
  using (true);

create policy businesses_select_authenticated
  on businesses for select to authenticated
  using (true);

-- Direct row insertion into businesses by authenticated users is forbidden (#120 / M7).
-- Business creation is restricted to service-role only (e.g. provisioning scripts).

create policy businesses_update_authenticated
  on businesses for update to authenticated
  using (public.is_business_member(id))
  with check (public.is_business_member(id));

create policy businesses_delete_authenticated
  on businesses for delete to authenticated
  using (public.is_business_owner(id));

-- Business Members
create policy business_members_select_authenticated
  on business_members for select to authenticated
  using (public.is_business_member(business_id) or user_id = (select auth.uid()));

create policy business_members_insert_authenticated
  on business_members for insert to authenticated
  with check (public.is_business_owner(business_id));

create policy business_members_update_authenticated
  on business_members for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy business_members_delete_authenticated
  on business_members for delete to authenticated
  using (public.is_business_owner(business_id));

-- Business Settings
-- Anonymous users can read business settings subject to column-level privileges below.
create policy business_settings_select_anon
  on business_settings for select to anon
  using (true);

-- Authenticated members may only read business settings for their own business (#120 / M8).
create policy business_settings_select_authenticated
  on business_settings for select to authenticated
  using (public.is_business_member(business_id));

create policy business_settings_insert_authenticated
  on business_settings for insert to authenticated
  with check (public.is_business_member(business_id));

create policy business_settings_update_authenticated
  on business_settings for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy business_settings_delete_authenticated
  on business_settings for delete to authenticated
  using (public.is_business_member(business_id));

-- Restrict anon SELECT on business_settings to storefront-public columns only (#120 / M8).
-- Storefront-public columns:
--   - Tenancy & currency: id, business_id, currency
--   - Ordering parameters: accepting_orders, service_types, opening_hours,
--     order_timing_asap, order_timing_scheduled, order_timing_time_optional,
--     delivery_fee, min_order_amount, lead_time_value, lead_time_unit
--   - Payment identifiers & customer instructions: revolut_revtag, wero_identifier,
--     payment_methods, payment_instructions_en, payment_instructions_fr
-- Private operational columns withheld from anon:
--   low_stock_threshold, tax_percentage, notifications, in_app_alerts, sound_alerts,
--   date_format, updated_at.
revoke select on public.business_settings from anon;
grant select (
  id,
  business_id,
  currency,
  accepting_orders,
  service_types,
  opening_hours,
  order_timing_asap,
  order_timing_scheduled,
  order_timing_time_optional,
  delivery_fee,
  min_order_amount,
  lead_time_value,
  lead_time_unit,
  revolut_revtag,
  wero_identifier,
  payment_methods,
  payment_instructions_en,
  payment_instructions_fr
) on public.business_settings to anon;

-- Product Categories
-- Anonymous users can read categories for public storefront menu navigation.
create policy product_categories_select_anon
  on product_categories for select to anon
  using (true);

create policy product_categories_select_authenticated
  on product_categories for select to authenticated
  using (true);

create policy product_categories_insert_authenticated
  on product_categories for insert to authenticated
  with check (public.is_business_member(business_id));

create policy product_categories_update_authenticated
  on product_categories for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy product_categories_delete_authenticated
  on product_categories for delete to authenticated
  using (public.is_business_member(business_id));

-- Products
create policy products_select_anon
  on products for select to anon
  using (visible = true);

create policy products_select_authenticated
  on products for select to authenticated
  using (public.is_business_member(business_id) or visible = true);

create policy products_insert_authenticated
  on products for insert to authenticated
  with check (public.is_business_member(business_id));

create policy products_update_authenticated
  on products for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy products_delete_authenticated
  on products for delete to authenticated
  using (public.is_business_member(business_id));

-- Guests
create policy guests_select_authenticated
  on guests for select to authenticated
  using (public.is_business_member(business_id));

create policy guests_insert_authenticated
  on guests for insert to authenticated
  with check (public.is_business_member(business_id));

create policy guests_update_authenticated
  on guests for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy guests_delete_authenticated
  on guests for delete to authenticated
  using (public.is_business_member(business_id));

-- Orders
create policy orders_select_authenticated
  on orders for select to authenticated
  using (public.is_business_member(business_id));

-- Direct insertion into orders by authenticated users is forbidden (#120 / M11).
-- Orders are created exclusively through the atomic place_order security-definer RPC (#121/#261)
-- to enforce inventory reservation, customer validation, and sequence consistency.

create policy orders_update_authenticated
  on orders for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy orders_delete_authenticated
  on orders for delete to authenticated
  using (public.is_business_member(business_id));

-- Order Items
create policy order_items_select_authenticated
  on order_items for select to authenticated
  using (public.is_business_member(business_id));

-- Direct insertion into order_items by authenticated users is forbidden (#120 / M11).
-- Line items are created atomically alongside orders via the place_order RPC (#121/#261).

create policy order_items_update_authenticated
  on order_items for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy order_items_delete_authenticated
  on order_items for delete to authenticated
  using (public.is_business_member(business_id));

-- Expenses
create policy expenses_select_authenticated
  on expenses for select to authenticated
  using (public.is_business_member(business_id));

create policy expenses_insert_authenticated
  on expenses for insert to authenticated
  with check (public.is_business_member(business_id));

create policy expenses_update_authenticated
  on expenses for update to authenticated
  using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));

create policy expenses_delete_authenticated
  on expenses for delete to authenticated
  using (public.is_business_member(business_id));

-- ----------------------------------------------------------------------------
-- 4. Security Definer RPC Functions (Storefront Tracking & Featured Products)
-- ----------------------------------------------------------------------------

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
    'items', coalesce(jsonb_agg(to_jsonb(oi)) filter (where oi.id is not null), '[]'::jsonb)
  )
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.tracking_token = p_tracking_token
  group by o.id;
$$;

revoke all on function public.get_order_by_tracking_token(text) from public;
grant execute on function public.get_order_by_tracking_token(text) to anon, authenticated, service_role;

create or replace function public.storefront_order_tracking_token(
  p_business_id uuid,
  p_order_number integer,
  p_phone text
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select o.tracking_token
  from orders o
  join guests g on o.guest_id = g.id
  where o.business_id = p_business_id
    and o.order_number = p_order_number
    and g.phone = p_phone
  limit 1;
$$;

revoke all on function public.storefront_order_tracking_token(uuid, integer, text) from public;
grant execute on function public.storefront_order_tracking_token(uuid, integer, text) to anon, authenticated, service_role;

create or replace function public.storefront_featured_products(
  p_business_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (product_id uuid, quantity bigint, last_ordered_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as product_id,
    sum(oi.quantity)::bigint as quantity,
    max(o.created_at) as last_ordered_at
  from public.orders o
  join public.order_items oi on oi.order_id = o.id and oi.business_id = o.business_id
  join public.products p on p.id = oi.product_id and p.business_id = o.business_id
  where o.business_id = p_business_id
    and p.visible = true
    and p.stock > 0
    and o.status <> 'CANCELLED'
    and o.paid::text <> 'refunded'
    and o.created_at between p_from and p_to
    and p_to <= now()
    and p_to >= now() - interval '2 hours'
    and p_to - p_from in (interval '7 days', interval '30 days')
  group by p.id;
$$;

revoke all on function public.storefront_featured_products(uuid, timestamptz, timestamptz) from public;
grant execute on function public.storefront_featured_products(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
