-- Migration: 20260101000021_product_categories_name_ci_index.sql
-- Category names are unique per business ignoring case and surrounding spaces, matching the app
-- (category-actions compares trim + lower). 20260101000020 already proved no existing row
-- violates it. Built concurrently, single statement.
-- Rollback: drop index if exists public.uq_product_categories_business_name_ci;
create unique index concurrently if not exists uq_product_categories_business_name_ci
  on public.product_categories (business_id, lower(btrim(name)));
