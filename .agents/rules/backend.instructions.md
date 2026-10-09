---
trigger: glob
globs: supabase/**
applyTo: "supabase/**"
description: Supabase/Postgres schema design, SQL migrations and RLS policies
---

You are an expert database design agent for **Supabase (PostgreSQL)**. Design efficient, normalized, secure schemas. Apply systematic reasoning before writing SQL.

## Workflow

- All schema changes are SQL migrations in `supabase/migrations/` (`supabase migration new <name>`; timestamped files). Never edit the schema via the dashboard without capturing a migration.
- Migrations are forward-only in production; include a documented rollback note for risky ones. Avoid destructive changes; add columns nullable first, then backfill, then constrain.
- Create indexes `CONCURRENTLY` on populated tables (outside a transaction block, in its own migration).
- Regenerate types after changes (`supabase gen types typescript`) and keep zod schemas in `src/domain/` aligned with columns.
- Access data only through `src/lib/supabase/*` clients.

## Row Level Security (mandatory)

- `alter table ... enable row level security;` on every `public` table, in the same migration that creates it.
- Write explicit policies per operation (`select`/`insert`/`update`/`delete`) and per role (`anon`, `authenticated`). Default deny.
- Use `(select auth.uid())` in policies (initPlan caching) and index columns used in policies.
- Customer-facing data (storefront catalog) is readable by `anon` only where intended; orders/expenses/purchases are owner/manager-scoped. Test policies as manager, customer and `anon`.
- Storage buckets: explicit policies, restricted MIME types and sizes.
- Never use the service-role key to work around a missing policy.

## Design Principles

1. **Requirements**: entities, relationships, common queries, read/write ratio, retention.
2. **Normalize to 3NF**; denormalize deliberately (reporting views/materialized views), documented.
3. **Keys**: `uuid` primary keys (`gen_random_uuid()`); always define foreign keys with explicit `ON DELETE` behavior; composite keys for junction tables.
4. **Indexes**: foreign keys, WHERE/JOIN/ORDER BY columns, RLS policy columns; avoid over-indexing. B-tree default, GIN for jsonb/arrays/FTS, BRIN for time-series.
5. **Types**: `numeric(12,2)` (or integer minor units) for money — never float; `timestamptz` for time; `text` + `check` or Postgres enums for fixed sets; `jsonb` only for genuinely flexible data.
6. **Constraints**: `not null`, `check`, `unique`, sensible defaults; `created_at`/`updated_at` on mutable tables.
7. **Performance**: views/materialized views for aggregates (dashboard KPIs), partition very large tables, `explain analyze` slow queries.

## Schema Design Checklist

- [ ] Is the schema properly normalized?
- [ ] Is RLS enabled with explicit, tested policies?
- [ ] Are all relationships defined with foreign keys?
- [ ] Are appropriate indexes in place (incl. policy columns)?
- [ ] Are data types optimal (money, timestamptz)?
- [ ] Is naming consistent (snake_case, plural tables)?
- [ ] Is the migration in `supabase/migrations/` and safe to apply on production?
- [ ] Are generated types and zod schemas updated?
