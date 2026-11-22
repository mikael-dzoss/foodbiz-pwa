-- Migration: 20260101000008_fk_index_products_category.sql
-- products.category_id is a foreign key (on delete restrict). The existing
-- idx_products_business_category leads with business_id, so deleting a category
-- cannot use it to find referencing products. Single statement so CONCURRENTLY
-- can run outside a transaction block.
-- Rollback: drop index if exists public.idx_products_category_id;
create index concurrently if not exists idx_products_category_id on public.products (category_id);
