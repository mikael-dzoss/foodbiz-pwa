-- ============================================================================
-- Migration: 20260101000011_rate_limit_attempts.sql
-- Description: Database-side rate limiting for the anonymous order and order
--              lookup paths. It holds across serverless instances and applies
--              to direct PostgREST callers, which bypass app-level checks.
--
--   * rate_limit_attempts: one row per recorded attempt, keyed by a SHA-256 hash
--     of (business_id, subject). The raw phone number is never stored. RLS is
--     enabled with NO policies and every API role is revoked, so only SECURITY
--     DEFINER functions (owned by the migration role) can touch it.
--   * rate_limit_key / rate_limit_is_exceeded / rate_limit_record: internal helpers
--     used by place_order and storefront_order_tracking_token. Not callable via
--     the API.
--
-- Note on hashing: the hash stops casual disclosure and avoids a second copy of
-- phone numbers, but E.164 numbers are low-entropy, so it is not protection
-- against a database operator. Rows live for at most one window (10 minutes).
--
-- The per-key advisory lock taken by rate_limit_is_exceeded lives until the end of the
-- calling transaction. For the per-business bucket this makes anonymous orders of one
-- business queue behind each other; they already serialize on the order-number lock, and a
-- transaction is a few milliseconds.
--
-- Pruning is opportunistic: rate_limit_is_exceeded deletes rows of its bucket
-- older than the window it is called with; there is no cron job.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.rate_limit_record(text, text);
--   drop function if exists public.rate_limit_is_exceeded(text, text, integer, interval);
--   drop function if exists public.rate_limit_key(uuid, text);
--   drop table if exists public.rate_limit_attempts;
-- ============================================================================

create table if not exists public.rate_limit_attempts (
  id bigint generated always as identity primary key,
  bucket text not null check (bucket in ('order_phone', 'order_business', 'lookup_phone')),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.rate_limit_attempts enable row level security;

-- Supabase default privileges grant new tables to the API roles: take them back.
revoke all on table public.rate_limit_attempts from public, anon, authenticated, service_role;

create index if not exists idx_rate_limit_attempts_bucket_key_created
  on public.rate_limit_attempts (bucket, key_hash, created_at);

-- SHA-256 hex of "<business_id>:<subject>".
create or replace function public.rate_limit_key(p_business_id uuid, p_subject text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(p_business_id::text || ':' || coalesce(p_subject, ''), 'UTF8')), 'hex');
$$;

-- Prunes expired rows of the bucket, then reports whether (bucket, key) already has
-- p_limit or more attempts inside the window. Takes a transaction-scoped advisory lock
-- on (bucket, key) so a concurrent caller cannot pass the check before this caller's
-- rate_limit_record is visible.
create or replace function public.rate_limit_is_exceeded(
  p_bucket text,
  p_key_hash text,
  p_limit integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('rate_limit:' || p_bucket || ':' || p_key_hash));

  delete from public.rate_limit_attempts
  where bucket = p_bucket
    and created_at < now() - p_window;

  select count(*) into v_count
  from public.rate_limit_attempts
  where bucket = p_bucket
    and key_hash = p_key_hash
    and created_at >= now() - p_window;

  return v_count >= p_limit;
end;
$$;

create or replace function public.rate_limit_record(p_bucket text, p_key_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.rate_limit_attempts (bucket, key_hash) values (p_bucket, p_key_hash);
$$;

revoke all on function public.rate_limit_key(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.rate_limit_is_exceeded(text, text, integer, interval) from public, anon, authenticated, service_role;
revoke all on function public.rate_limit_record(text, text) from public, anon, authenticated, service_role;
