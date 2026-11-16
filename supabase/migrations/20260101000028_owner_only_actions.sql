-- ============================================================================
-- Migration: 20260101000028_owner_only_actions.sql
-- Description: Role-based authorization ("owner-only sensitive actions"). Until now every
--   policy used is_business_member, so a staff member could change where customers send money.
--   Only an OWNER (business_members.role = 'owner') may now:
--     1. change payment identifiers and payment-method settings: business_settings.revolut_revtag,
--        wero_identifier, payment_methods, payment_instructions_en, payment_instructions_fr
--        (there is no bank-details column; the instructions text is where bank details would be
--        typed, so it is protected too);
--     2. change the business slug (the public storefront address);
--     3. hard-delete rows: orders, expenses, guests, products;
--     4. nobody (not even an owner) may delete the business_settings row through the API: the
--        delete policy and the DELETE privilege are removed (service_role and direct database
--        connections still can; deleting a business cascades). Inserting a settings row is
--        owner-only too (the row exists from provisioning).
--   Managers and staff keep everything else. Categories stay deletable by any member (see the
--   PR notes); the products foreign key already refuses to delete a non-empty category.
--
--   Column rules: RLS cannot compare old and new values, so a BEFORE UPDATE trigger raises
--   OWNER_REQUIRED (SQLSTATE 42501) when a protected column changes and the caller is not an
--   owner. Chosen over splitting the writes into functions because it needs no change of the
--   existing write path (PostgREST update), covers every current and future caller, and is one
--   small function. Callers with no user identity (auth.uid() is null: service_role, direct
--   database connections such as migrations and the dashboard SQL editor) are exempt: they are not
--   members, and the trigger is about members.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop trigger if exists businesses_owner_only_columns on public.businesses;
--   drop trigger if exists business_settings_owner_only_columns on public.business_settings;
--   drop function if exists public.enforce_owner_only_columns();
--   and re-create the member-wide policies listed in 20260101000001 (orders/expenses/guests/products
--   delete, business_settings insert and delete).
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

-- ----------------------------------------------------------------------------
-- 1. Column-level rules
-- ----------------------------------------------------------------------------
create or replace function public.enforce_owner_only_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_protected_changed boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_table_name = 'businesses' then
    v_business_id := new.id;
    v_protected_changed := new.slug is distinct from old.slug;
  elsif tg_table_name = 'business_settings' then
    v_business_id := new.business_id;
    v_protected_changed :=
      new.revolut_revtag is distinct from old.revolut_revtag
      or new.wero_identifier is distinct from old.wero_identifier
      or new.payment_methods is distinct from old.payment_methods
      or new.payment_instructions_en is distinct from old.payment_instructions_en
      or new.payment_instructions_fr is distinct from old.payment_instructions_fr;
  end if;

  if v_protected_changed and not public.is_business_owner(v_business_id) then
    raise exception 'OWNER_REQUIRED: only an owner can change this setting' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_owner_only_columns() from public, anon, authenticated;

drop trigger if exists businesses_owner_only_columns on public.businesses;
create trigger businesses_owner_only_columns
  before update on public.businesses
  for each row execute function public.enforce_owner_only_columns();

drop trigger if exists business_settings_owner_only_columns on public.business_settings;
create trigger business_settings_owner_only_columns
  before update on public.business_settings
  for each row execute function public.enforce_owner_only_columns();

-- ----------------------------------------------------------------------------
-- 2. Hard deletes: owner only
-- ----------------------------------------------------------------------------
drop policy if exists orders_delete_authenticated on public.orders;
create policy orders_delete_authenticated
  on public.orders for delete to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists expenses_delete_authenticated on public.expenses;
create policy expenses_delete_authenticated
  on public.expenses for delete to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists guests_delete_authenticated on public.guests;
create policy guests_delete_authenticated
  on public.guests for delete to authenticated
  using (public.is_business_owner(business_id));

drop policy if exists products_delete_authenticated on public.products;
create policy products_delete_authenticated
  on public.products for delete to authenticated
  using (public.is_business_owner(business_id));

-- ----------------------------------------------------------------------------
-- 3. business_settings: no delete for anyone through the API, insert for owners only
-- ----------------------------------------------------------------------------
drop policy if exists business_settings_delete_authenticated on public.business_settings;
revoke delete on public.business_settings from anon, authenticated;

drop policy if exists business_settings_insert_authenticated on public.business_settings;
create policy business_settings_insert_authenticated
  on public.business_settings for insert to authenticated
  with check (public.is_business_owner(business_id));

reset lock_timeout;
