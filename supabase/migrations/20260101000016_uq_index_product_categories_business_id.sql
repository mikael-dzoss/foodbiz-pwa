-- Migration: 20260101000016_uq_index_product_categories_business_id.sql
-- Parent-side index for the tenant-safe composite foreign keys (see 20260101000022):
-- a foreign key on (business_id, <id>) needs a unique constraint on (business_id, id) in
-- public.product_categories. id is already the primary key, so the pair is trivially unique and the index
-- cannot fail on existing data. Built concurrently (no write lock) as a single statement so it
-- can run outside a transaction block; 20260101000022 promotes it to a constraint.
-- Rollback: drop index if exists public.uq_product_categories_business_id_id;
-- Runbook: if this build fails or is cancelled it leaves an INVALID index that `if not exists` then skips.
-- Check with: select indexrelid::regclass from pg_index where not indisvalid;
-- then `drop index concurrently <name>;` and re-run this migration.
create unique index concurrently if not exists uq_product_categories_business_id_id
  on public.product_categories (business_id, id);
