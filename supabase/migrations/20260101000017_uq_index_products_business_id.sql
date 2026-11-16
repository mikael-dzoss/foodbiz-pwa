-- Migration: 20260101000017_uq_index_products_business_id.sql
-- Parent-side index for the tenant-safe composite foreign keys (see 20260101000022):
-- a foreign key on (business_id, <id>) needs a unique constraint on (business_id, id) in
-- public.products. id is already the primary key, so the pair is trivially unique and the index
-- cannot fail on existing data. Built concurrently (no write lock) as a single statement so it
-- can run outside a transaction block; 20260101000022 promotes it to a constraint.
-- Rollback: drop index if exists public.uq_products_business_id_id;
create unique index concurrently if not exists uq_products_business_id_id
  on public.products (business_id, id);
