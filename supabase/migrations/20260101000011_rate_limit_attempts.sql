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
-- Locking: rate_limit_is_exceeded can take a transaction-scoped advisory lock on
-- (bucket, key) so two concurrent callers of the SAME key cannot both pass the check
-- (used for the per-phone buckets). The per-business buckets are soft flood brakes and
-- are counted WITHOUT a lock (off by a few under concurrency is fine), so a flood of
-- anonymous requests never queues real customers behind a business-wide lock.
--
-- Note on hashing: the hash stops casual disclosure and avoids a second copy of
-- phone numbers, but E.164 numbers are low-entropy, so it is not protection
-- against a database operator. Hashes are NOT deleted on a timer: rows of a bucket
-- are pruned opportunistically the next time that same bucket is checked, so a hashed
-- phone can persist until then (idle bucket, idle rows). Each prune is bounded to 500
-- rows so no single request pays for a large delete; the table is only ever large after
-- a flood, and the next calls drain it.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop function if exists public.rate_limit_record(text, text);
--   drop function if exists public.rate_limit_is_exceeded(text, text, integer, interval, boolean);
--   drop function if exists public.rate_limit_key(uuid, text);
--   drop table if exists public.rate_limit_attempts;
-- ============================================================================

create table if not exists public.rate_limit_attempts (
  id bigint generated always as identity primary key,
  bucket text not null check (
    bucket in ('order_phone', 'order_business', 'lookup_phone', 'lookup_business')
  ),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.rate_limit_attempts enable row level security;

-- Supabase default privileges grant new tables to the API roles: take them back.
revoke all on table public.rate_limit_attempts from public, anon, authenticated, service_role;

-- Window counts for one key.
create index if not exists idx_rate_limit_attempts_bucket_key_created
  on public.rate_limit_attempts (bucket, key_hash, created_at);

-- Bounded opportunistic prune: expired rows of one bucket by age.
create index if not exists idx_rate_limit_attempts_bucket_created
  on public.rate_limit_attempts (bucket, created_at);

-- SHA-256 hex of "<business_id>:<subject>".
create or replace function public.rate_limit_key(p_business_id uuid, p_subject text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_business_id::text || ':' || coalesce(p_subject, ''), 'UTF8')), 'hex');
$$;

-- Prunes (at most 500) expired rows of the bucket, then reports whether (bucket, key) already
-- has p_limit or more attempts inside the window. With p_lock = true it first takes a
-- transaction-scoped advisory lock on (bucket, key), so a concurrent caller of the same key
-- cannot pass the check before this caller's rate_limit_record is visible.
create or replace function public.rate_limit_is_exceeded(
  p_bucket text,
  p_key_hash text,
  p_limit integer,
  p_window interval,
  p_lock boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_lock then
    perform pg_advisory_xact_lock(hashtext('rate_limit:' || p_bucket || ':' || p_key_hash));
  end if;

  delete from public.rate_limit_attempts
  where ctid in (
    select ctid
    from public.rate_limit_attempts
    where bucket = p_bucket
      and created_at < now() - p_window
    limit 500
  );

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
set search_path = ''
as $$
  insert into public.rate_limit_attempts (bucket, key_hash) values (p_bucket, p_key_hash);
$$;

revoke all on function public.rate_limit_key(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.rate_limit_is_exceeded(text, text, integer, interval, boolean) from public, anon, authenticated, service_role;
revoke all on function public.rate_limit_record(text, text) from public, anon, authenticated, service_role;
