-- Migration: 20260101000009_fk_index_orders_guest.sql
-- orders.guest_id is a foreign key (on delete restrict). idx_orders_business_guest
-- leads with business_id and cannot serve the FK check when a guest is deleted.
-- Single statement so CONCURRENTLY can run outside a transaction block.
-- Rollback: drop index if exists public.idx_orders_guest_id;
create index concurrently if not exists idx_orders_guest_id on public.orders (guest_id);
