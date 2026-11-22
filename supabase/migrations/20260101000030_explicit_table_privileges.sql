-- ============================================================================
-- Migration: 20260101000030_explicit_table_privileges.sql
-- Description: Make every public table's privileges explicit and stop relying
--              on Supabase's legacy default privileges (Refs #112).
--
--   Why: Supabase projects created since 2026-05-30 no longer auto-grant new
--   public tables or sequences to anon, authenticated and service_role, while
--   the local CLI stack still has the legacy defaults. Earlier migrations
--   assumed those defaults existed and only revoked exceptions, leaving hosted
--   staging unreachable with `42501 permission denied for table ...`.
--
--   What this migration does (in a single transaction so there is no window
--   where tables lack grants):
--     1. Revokes default table and sequence privileges for role `postgres` in
--        schema `public` from anon, authenticated and service_role so local
--        matches hosted for every future table (function defaults and other
--        roles' defaults are left untouched).
--     2. Revokes all privileges on every public base table from anon,
--        authenticated and service_role, then explicitly grants the exact DML
--        matrix (dropping TRUNCATE, REFERENCES and TRIGGER, which are unused
--        and TRUNCATE bypasses RLS) and re-grants the storefront column-level
--        SELECT lists on business_settings and products.
--
-- Idempotent: ALTER DEFAULT PRIVILEGES REVOKE, REVOKE ALL and GRANT are safe
-- to run whether grants already exist (local) or do not yet exist (staging).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   To restore legacy defaults locally only:
--     alter default privileges for role postgres in schema public
--       grant all on tables to anon, authenticated, service_role;
--     alter default privileges for role postgres in schema public
--       grant all on sequences to anon, authenticated, service_role;
--   Table grants themselves are required on hosted projects and should not be removed.
-- ============================================================================

begin;

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set local lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. Align default privileges with hosted Supabase (>= 2026-05-30)
-- ----------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Explicit table privileges (DML only) and column-level SELECT grants
-- ----------------------------------------------------------------------------

-- Full DML for all three API roles (RLS governs row access).
revoke all on table
  public.businesses,
  public.business_members,
  public.expenses,
  public.guests,
  public.product_categories
from anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.businesses,
  public.business_members,
  public.expenses,
  public.guests,
  public.product_categories
to anon, authenticated, service_role;

-- business_settings: anon keeps IU + column-scoped SELECT (storefront-public
-- columns only; private operational columns withheld, 20260101000001 and
-- 20260101000029); authenticated cannot DELETE (20260101000028).
revoke all on table public.business_settings from anon, authenticated, service_role;

grant insert, update on table public.business_settings to anon;
grant select (
  accepting_orders,
  business_id,
  currency,
  delivery_fee,
  id,
  lead_time_unit,
  lead_time_value,
  min_order_amount,
  opening_hours,
  order_timing_asap,
  order_timing_scheduled,
  order_timing_time_optional,
  payment_instructions_en,
  payment_instructions_fr,
  payment_methods,
  revolut_revtag,
  service_types,
  timezone,
  wero_identifier
) on table public.business_settings to anon;

grant select, insert, update on table public.business_settings to authenticated;
grant select, insert, update, delete on table public.business_settings to service_role;

-- products: anon keeps IUD + column-scoped SELECT (PUBLIC_PRODUCT_COLUMNS;
-- unit_cost, created_at and updated_at withheld, 20260101000006).
revoke all on table public.products from anon, authenticated, service_role;

grant insert, update, delete on table public.products to anon;
grant select (
  allergens,
  business_id,
  category_id,
  description,
  id,
  image_url,
  name,
  price,
  stock,
  suggest_add_ons,
  visible
) on table public.products to anon;

grant select, insert, update, delete on table public.products to authenticated, service_role;

-- orders: writes go through SECURITY DEFINER RPCs; authenticated keeps DELETE
-- for the owner-only policy (20260101000027, 20260101000028).
revoke all on table public.orders from anon, authenticated, service_role;

grant select on table public.orders to anon;
grant select, delete on table public.orders to authenticated;
grant select, insert, update, delete on table public.orders to service_role;

-- order_items: writes go through SECURITY DEFINER RPCs (20260101000027).
revoke all on table public.order_items from anon, authenticated, service_role;

grant select on table public.order_items to anon, authenticated;
grant select, insert, update, delete on table public.order_items to service_role;

-- rate_limit_attempts: internal to SECURITY DEFINER helpers; no direct API access (20260101000011).
revoke all on table public.rate_limit_attempts from anon, authenticated, service_role;

commit;
