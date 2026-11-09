-- ============================================================================
-- Migration: 20260101000004_realtime_orders.sql
-- Description: Enable Supabase Realtime publication and full replica identity
--              for public.orders to support instant new-order alerts (#124).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   alter publication supabase_realtime drop table if exists public.orders;
--   alter table public.orders replica identity default;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enable Realtime publication for orders
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

-- ----------------------------------------------------------------------------
-- 2. Configure Replica Identity for Realtime CDC
-- ----------------------------------------------------------------------------
-- Note on CDC filtering and RLS:
-- Realtime client filters like `filter: business_id=eq.<id>` evaluate against
-- the CDC record. For INSERT events, Postgres WAL provides all new column values
-- even under default replica identity.
-- However, for UPDATE and DELETE events with non-primary-key filters and RLS,
-- default replica identity only logs the primary key (id) in the old record,
-- which prevents column filtering and causes RLS checks on non-PK columns to fail.
-- Setting REPLICA IDENTITY FULL ensures all column values are available in the WAL
-- for CDC replication, allowing both filtering and RLS evaluation across operations.

alter table public.orders replica identity full;
