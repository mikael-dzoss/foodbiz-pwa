-- ============================================================================
-- Migration: 20260101000020_product_categories_name_ci_precheck.sql
-- Description: Pre-check for the case-insensitive category name index (20260101000021).
--   The database allows "Bread" and "bread" in one business (unique (business_id, name) is
--   case-sensitive) while the app treats them as duplicates. This raises a clear error
--   listing every offending group instead of letting the index build fail with a bare
--   "could not create unique index". Nothing is changed or deleted: resolve the listed
--   categories (rename or merge them) and re-run the migration.
-- Rollback: nothing to undo (read-only check).
-- ============================================================================
do $$
declare
  v_dupes text;
begin
  select string_agg(
           format('business %s: "%s" (category ids %s)', business_id, lower(btrim(name)), ids),
           E'\n'
         )
    into v_dupes
    from (
      select business_id, lower(btrim(name)) as name, string_agg(id::text, ', ') as ids
        from public.product_categories
       group by business_id, lower(btrim(name))
      having count(*) > 1
    ) d;

  if v_dupes is not null then
    raise exception E'DUPLICATE_CATEGORY_NAMES: case-insensitive duplicate category names exist, rename or merge them first:\n%', v_dupes
      using errcode = '23505';
  end if;
end
$$;
