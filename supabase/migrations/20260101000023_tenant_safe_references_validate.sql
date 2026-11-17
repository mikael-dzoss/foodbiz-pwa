-- ============================================================================
-- Migration: 20260101000023_tenant_safe_references_validate.sql
-- Description: Validate the composite foreign keys added NOT VALID in 20260101000022 (scans
--   the child tables under SHARE UPDATE EXCLUSIVE, which does not block reads or writes),
--   then drop the single-column keys the composite ones make redundant: a composite key on
--   (business_id, x) already implies x exists, so the old keys would only duplicate every
--   check and cascade.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   alter table public.products add constraint products_category_id_fkey
--     foreign key (category_id) references public.product_categories(id) on delete restrict;
--   alter table public.orders add constraint orders_guest_id_fkey
--     foreign key (guest_id) references public.guests(id) on delete restrict;
--   alter table public.order_items add constraint order_items_order_id_fkey
--     foreign key (order_id) references public.orders(id) on delete cascade;
--   alter table public.order_items add constraint order_items_product_id_fkey
--     foreign key (product_id) references public.products(id) on delete set null;
-- ============================================================================

alter table public.products validate constraint products_business_category_fkey;
alter table public.orders validate constraint orders_business_guest_fkey;
alter table public.order_items validate constraint order_items_business_order_fkey;
alter table public.order_items validate constraint order_items_business_product_fkey;

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

alter table public.products drop constraint products_category_id_fkey;
alter table public.orders drop constraint orders_guest_id_fkey;
alter table public.order_items drop constraint order_items_order_id_fkey;
alter table public.order_items drop constraint order_items_product_id_fkey;

reset lock_timeout;
