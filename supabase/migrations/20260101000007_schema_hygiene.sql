-- ============================================================================
-- Migration: 20260101000007_schema_hygiene.sql
-- Description: Small audit fixes.
--   * set_updated_at() gets a pinned (empty) search_path. now() lives in
--     pg_catalog, which is always searched, so the body is unchanged.
--   * idx_orders_tracking_token duplicated the index behind the
--     orders_tracking_token_unique constraint; the duplicate is dropped.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   create index if not exists idx_orders_tracking_token on orders(tracking_token);
--   -- set_updated_at: re-create without `set search_path` (see initial schema).
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop index if exists public.idx_orders_tracking_token;
