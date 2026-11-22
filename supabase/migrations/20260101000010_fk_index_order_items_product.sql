-- Migration: 20260101000010_fk_index_order_items_product.sql
-- order_items.product_id is a foreign key (on delete set null). idx_order_items_business_product
-- leads with business_id and cannot serve the FK action when a product is deleted.
-- Single statement so CONCURRENTLY can run outside a transaction block.
-- Rollback: drop index if exists public.idx_order_items_product_id;
create index concurrently if not exists idx_order_items_product_id on public.order_items (product_id);
