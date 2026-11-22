-- ============================================================================
-- Test Suite: table_privileges.test.sql
-- Description: Locks down explicit table and column privileges for anon,
--              authenticated and service_role across every public base table,
--              and verifies postgres default privileges in public grant
--              nothing on new tables or sequences (matching hosted Supabase
--              projects created since 2026-05-30).
-- Deliberately does NOT re-grant table privileges (the migrations' privileges are under test).
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(34);

-- ----------------------------------------------------------------------------
-- 1. Exhaustive table guard: any new public base table must be added here
--    with explicit grants in its migration.
-- ----------------------------------------------------------------------------
select set_eq(
  $$
    select table_name::text collate "default"
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  $$,
  array[
    'business_members',
    'business_settings',
    'businesses',
    'expenses',
    'guests',
    'order_items',
    'orders',
    'product_categories',
    'products',
    'rate_limit_attempts'
  ]::text[],
  'public base tables match the audited privilege matrix'
);

-- ----------------------------------------------------------------------------
-- 2. Default privileges: future tables and sequences created by postgres in
--    public grant nothing to anon, authenticated or service_role.
-- ----------------------------------------------------------------------------
select is_empty(
  $$
    select d.defaclobjtype, pg_get_userbyid(a.grantee), a.privilege_type
    from pg_catalog.pg_default_acl d
    join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where n.nspname = 'public'
      and d.defaclrole = 'postgres'::regrole
      and d.defaclobjtype in ('r', 'S')
      and a.grantee in ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  $$,
  'default privileges for postgres in public grant nothing on tables or sequences to API roles'
);

-- ----------------------------------------------------------------------------
-- 3. Table-level privilege matrix (DML only; no TRUNCATE/REFERENCES/TRIGGER)
-- ----------------------------------------------------------------------------

-- businesses
select table_privs_are('public', 'businesses', 'anon', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'businesses privileges for anon');
select table_privs_are('public', 'businesses', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'businesses privileges for authenticated');
select table_privs_are('public', 'businesses', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'businesses privileges for service_role');

-- business_members
select table_privs_are('public', 'business_members', 'anon', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'business_members privileges for anon');
select table_privs_are('public', 'business_members', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'business_members privileges for authenticated');
select table_privs_are('public', 'business_members', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'business_members privileges for service_role');

-- expenses
select table_privs_are('public', 'expenses', 'anon', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'expenses privileges for anon');
select table_privs_are('public', 'expenses', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'expenses privileges for authenticated');
select table_privs_are('public', 'expenses', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'expenses privileges for service_role');

-- guests
select table_privs_are('public', 'guests', 'anon', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'guests privileges for anon');
select table_privs_are('public', 'guests', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'guests privileges for authenticated');
select table_privs_are('public', 'guests', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'guests privileges for service_role');

-- product_categories
select table_privs_are('public', 'product_categories', 'anon', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'product_categories privileges for anon');
select table_privs_are('public', 'product_categories', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'product_categories privileges for authenticated');
select table_privs_are('public', 'product_categories', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'product_categories privileges for service_role');

-- business_settings
select table_privs_are('public', 'business_settings', 'anon', array['INSERT', 'UPDATE'], 'business_settings table privileges for anon');
select table_privs_are('public', 'business_settings', 'authenticated', array['SELECT', 'INSERT', 'UPDATE'], 'business_settings privileges for authenticated');
select table_privs_are('public', 'business_settings', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'business_settings privileges for service_role');

-- products
select table_privs_are('public', 'products', 'anon', array['INSERT', 'UPDATE', 'DELETE'], 'products table privileges for anon');
select table_privs_are('public', 'products', 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'products privileges for authenticated');
select table_privs_are('public', 'products', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'products privileges for service_role');

-- orders
select table_privs_are('public', 'orders', 'anon', array['SELECT'], 'orders privileges for anon');
select table_privs_are('public', 'orders', 'authenticated', array['SELECT', 'DELETE'], 'orders privileges for authenticated');
select table_privs_are('public', 'orders', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'orders privileges for service_role');

-- order_items
select table_privs_are('public', 'order_items', 'anon', array['SELECT'], 'order_items privileges for anon');
select table_privs_are('public', 'order_items', 'authenticated', array['SELECT'], 'order_items privileges for authenticated');
select table_privs_are('public', 'order_items', 'service_role', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'], 'order_items privileges for service_role');

-- rate_limit_attempts
select table_privs_are('public', 'rate_limit_attempts', 'anon', '{}'::name[], 'rate_limit_attempts privileges for anon');
select table_privs_are('public', 'rate_limit_attempts', 'authenticated', '{}'::name[], 'rate_limit_attempts privileges for authenticated');
select table_privs_are('public', 'rate_limit_attempts', 'service_role', '{}'::name[], 'rate_limit_attempts privileges for service_role');

-- ----------------------------------------------------------------------------
-- 4. Column-level SELECT privileges for anon
-- ----------------------------------------------------------------------------
select results_eq(
  $$
    select column_name::text collate "default"
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'business_settings'
      and grantee = 'anon'
      and privilege_type = 'SELECT'
    order by column_name::text collate "C"
  $$,
  array[
    'accepting_orders',
    'business_id',
    'currency',
    'delivery_fee',
    'id',
    'lead_time_unit',
    'lead_time_value',
    'min_order_amount',
    'opening_hours',
    'order_timing_asap',
    'order_timing_scheduled',
    'order_timing_time_optional',
    'payment_instructions_en',
    'payment_instructions_fr',
    'payment_methods',
    'revolut_revtag',
    'service_types',
    'timezone',
    'wero_identifier'
  ]::text[],
  'anon has column SELECT on exactly the storefront columns of business_settings'
);

select results_eq(
  $$
    select column_name::text collate "default"
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'products'
      and grantee = 'anon'
      and privilege_type = 'SELECT'
    order by column_name::text collate "C"
  $$,
  array[
    'allergens',
    'business_id',
    'category_id',
    'description',
    'id',
    'image_url',
    'name',
    'price',
    'stock',
    'suggest_add_ons',
    'visible'
  ]::text[],
  'anon has column SELECT on exactly the storefront columns of products'
);

select * from finish();

rollback;
