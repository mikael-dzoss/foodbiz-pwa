-- Migration: 20260101000013_orders_idempotency_index.sql
-- Unique partial index behind idempotent place_order: one order per (business, key).
-- Built concurrently (a non-concurrent unique build scans the heap under a SHARE lock that blocks
-- order writes), as a single statement so it can run outside a transaction block.
-- Rollback: drop index if exists public.idx_orders_business_idempotency_key;
create unique index concurrently if not exists idx_orders_business_idempotency_key
  on public.orders (business_id, idempotency_key)
  where idempotency_key is not null;
