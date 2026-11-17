-- ============================================================================
-- Migration: 20260101000022_tenant_safe_references.sql
-- Description: Tenant-safe references. The foreign keys were single-column, so nothing forced
--   the referenced row to belong to the same business: a member of business A could point a
--   product at business B's category or an order at B's guest. This adds composite foreign
--   keys on (business_id, <id>) so the database itself refuses cross-tenant references.
--
--   1. Promote the concurrently built (business_id, id) unique indexes (16-19) to constraints.
--      A unique constraint on a pair that contains the primary key cannot fail on existing data.
--   2. Pre-check: raise a clear error listing offending ids if any cross-tenant reference
--      already exists (there should be none). Nothing is modified or deleted.
--   3. Add the composite foreign keys as NOT VALID (takes only a brief lock, checks new and
--      updated rows from now on). 20260101000023 validates them and drops the old single-column
--      keys, so the long validation scan does not hold this file's lock.
--
--   Kept ON DELETE behaviours: products.category_id restrict, orders.guest_id restrict,
--   order_items.order_id cascade, order_items.product_id set null. For the last one the
--   Postgres 15 column-list form `set null (product_id)` is required: a plain `set null` on a
--   composite key would also null the NOT NULL business_id and fail.
--   order_items.product_id is nullable: with the default MATCH SIMPLE a null product_id skips
--   the check, as before.
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   alter table public.order_items drop constraint if exists order_items_business_product_fkey;
--   alter table public.order_items drop constraint if exists order_items_business_order_fkey;
--   alter table public.orders drop constraint if exists orders_business_guest_fkey;
--   alter table public.products drop constraint if exists products_business_category_fkey;
--   (the single-column keys are re-created by the rollback note of 20260101000023)
-- ============================================================================

-- Fail fast instead of queueing behind a long transaction while holding the lock request.
set lock_timeout = '5s';

alter table public.product_categories
  add constraint product_categories_business_id_id_unique
  unique using index uq_product_categories_business_id_id;
alter table public.products
  add constraint products_business_id_id_unique
  unique using index uq_products_business_id_id;
alter table public.guests
  add constraint guests_business_id_id_unique
  unique using index uq_guests_business_id_id;
alter table public.orders
  add constraint orders_business_id_id_unique
  unique using index uq_orders_business_id_id;

do $$
declare
  v_report text := '';
  v_rows text;
begin
  select string_agg(format('product %s (business %s) -> category %s (business %s)',
                           p.id, p.business_id, c.id, c.business_id), E'\n')
    into v_rows
    from public.products p
    join public.product_categories c on c.id = p.category_id
   where c.business_id <> p.business_id;
  if v_rows is not null then v_report := v_report || E'\nproducts.category_id:\n' || v_rows; end if;

  select string_agg(format('order %s (business %s) -> guest %s (business %s)',
                           o.id, o.business_id, g.id, g.business_id), E'\n')
    into v_rows
    from public.orders o
    join public.guests g on g.id = o.guest_id
   where g.business_id <> o.business_id;
  if v_rows is not null then v_report := v_report || E'\norders.guest_id:\n' || v_rows; end if;

  select string_agg(format('order_item %s (business %s) -> order %s (business %s)',
                           i.id, i.business_id, o.id, o.business_id), E'\n')
    into v_rows
    from public.order_items i
    join public.orders o on o.id = i.order_id
   where o.business_id <> i.business_id;
  if v_rows is not null then v_report := v_report || E'\norder_items.order_id:\n' || v_rows; end if;

  select string_agg(format('order_item %s (business %s) -> product %s (business %s)',
                           i.id, i.business_id, p.id, p.business_id), E'\n')
    into v_rows
    from public.order_items i
    join public.products p on p.id = i.product_id
   where p.business_id <> i.business_id;
  if v_rows is not null then v_report := v_report || E'\norder_items.product_id:\n' || v_rows; end if;

  if v_report <> '' then
    raise exception E'CROSS_TENANT_REFERENCES: rows reference another business, fix or delete them before applying this migration:%', v_report
      using errcode = '23503';
  end if;
end
$$;

alter table public.products
  add constraint products_business_category_fkey
  foreign key (business_id, category_id)
  references public.product_categories (business_id, id)
  on delete restrict
  not valid;

alter table public.orders
  add constraint orders_business_guest_fkey
  foreign key (business_id, guest_id)
  references public.guests (business_id, id)
  on delete restrict
  not valid;

alter table public.order_items
  add constraint order_items_business_order_fkey
  foreign key (business_id, order_id)
  references public.orders (business_id, id)
  on delete cascade
  not valid;

alter table public.order_items
  add constraint order_items_business_product_fkey
  foreign key (business_id, product_id)
  references public.products (business_id, id)
  on delete set null (product_id)
  not valid;

reset lock_timeout;
