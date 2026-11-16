-- ============================================================================
-- Migration: 20260101000012_orders_idempotency_columns.sql
-- Description: Columns behind idempotent place_order (see 20260101000014):
--   * orders.idempotency_key: client-generated uuid, nullable (legacy and non-storefront
--     orders have none).
--   * orders.idempotency_payload_hash: SHA-256 of the normalized order payload placed under
--     that key, so a replay with a different cart is rejected. NULL on legacy rows means
--     "no payload check".
-- Both are nullable columns without defaults: a metadata-only change, safe on populated
-- tables. The unique index is built concurrently in the next migration.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   alter table public.orders drop column if exists idempotency_payload_hash;
--   alter table public.orders drop column if exists idempotency_key;
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

alter table public.orders add column if not exists idempotency_key uuid;
alter table public.orders add column if not exists idempotency_payload_hash text;

reset lock_timeout;
