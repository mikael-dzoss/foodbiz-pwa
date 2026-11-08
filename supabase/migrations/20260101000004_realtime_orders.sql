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

alter table public.orders replica identity full;
