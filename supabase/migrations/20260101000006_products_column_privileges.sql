-- ============================================================================
-- Migration: 20260101000006_products_column_privileges.sql
-- Description: Keep products.unit_cost (a private margin figure) away from
--              every role that is not a member of the owning business.
--
--   1. anon: table-level SELECT is revoked and only the storefront columns are
--      granted (same technique as business_settings). The grant MUST match
--      PUBLIC_PRODUCT_COLUMNS in src/lib/repositories/supabase/adapter.ts.
--   2. authenticated: the select policy no longer lets non-members read other
--      tenants' visible products (column grants cannot separate rows, and a
--      logged-in user of tenant A reading tenant B's rows would see unit_cost).
--      The storefront always reads through the session-less anon client, so
--      nothing legitimate depends on that branch.
--
-- Audit of the other anon-readable tables (policy `using (true)`):
--   businesses         : id, name, slug, currency, description, phone, email,
--                        whatsapp_number, instagram_url, facebook_url,
--                        tiktok_url, address, latitude, longitude, logo_url,
--                        created_at, updated_at. All are storefront profile
--                        data shown on the shop-info page; none is private.
--   product_categories : id, business_id, name, sort_order, role, created_at.
--                        Menu structure only; none is private.
--   No column grants are needed on either table.
--
-- Idempotent: revoke/grant and drop-policy-if-exists can be re-run safely.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   grant select on public.products to anon;
--   drop policy if exists products_select_authenticated on products;
--   create policy products_select_authenticated on products for select to authenticated
--     using (public.is_business_member(business_id) or visible = true);
-- ============================================================================

revoke select on public.products from anon;

-- Keep in sync with PUBLIC_PRODUCT_COLUMNS (src/lib/repositories/supabase/adapter.ts).
-- Withheld from anon: unit_cost, created_at, updated_at.
grant select (
  id,
  business_id,
  category_id,
  name,
  description,
  price,
  stock,
  visible,
  suggest_add_ons,
  allergens,
  image_url
) on public.products to anon;

drop policy if exists products_select_authenticated on products;

create policy products_select_authenticated
  on products for select to authenticated
  using (public.is_business_member(business_id));
