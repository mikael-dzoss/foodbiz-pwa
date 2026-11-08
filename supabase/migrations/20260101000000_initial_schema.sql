-- ============================================================================
-- Migration: 20260101000000_initial_schema.sql
-- Description: Initial FoodBiz PWA relational schema, enums, indexes,
--              triggers, and mandatory Row Level Security activation (#119).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop trigger if exists trigger_orders_updated_at on orders;
--   drop trigger if exists trigger_products_updated_at on products;
--   drop trigger if exists trigger_business_settings_updated_at on business_settings;
--   drop trigger if exists trigger_businesses_updated_at on businesses;
--   drop function if exists set_updated_at();
--   drop table if exists expenses, order_items, orders, guests, products,
--     product_categories, business_settings, business_members, businesses cascade;
--   drop type if exists order_payment_method, order_payment_preference,
--     order_channel, order_service_type, order_paid_status, order_status,
--     date_format, business_member_role, category_role;
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Custom ENUM Types
-- ----------------------------------------------------------------------------
create type category_role as enum ('regular', 'drinks', 'snacks');
create type business_member_role as enum ('owner', 'manager', 'staff');
create type date_format as enum ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD');

create type order_status as enum (
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED'
);

create type order_paid_status as enum ('paid', 'unpaid', 'refunded');
create type order_service_type as enum ('pickup', 'delivery', 'dine-in');
create type order_channel as enum ('storefront', 'phone', 'whatsapp', 'in-person');
create type order_payment_preference as enum ('revolut', 'wero', 'on_handover');
create type order_payment_method as enum ('cash', 'revolut', 'wero');

-- ----------------------------------------------------------------------------
-- 1. Businesses & Tenancy
-- ----------------------------------------------------------------------------
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 1),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  currency text not null default 'EUR' check (currency = 'EUR'),
  description text check (description is null or char_length(trim(description)) <= 500),
  phone text,
  email text,
  whatsapp_number text,
  instagram_url text check (instagram_url is null or instagram_url = '' or instagram_url ~ '^https://'),
  facebook_url text check (facebook_url is null or facebook_url = '' or facebook_url ~ '^https://'),
  tiktok_url text check (tiktok_url is null or tiktok_url = '' or tiktok_url ~ '^https://'),
  address text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_slug_unique unique (slug)
);

alter table businesses enable row level security;

create table business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role business_member_role not null default 'staff',
  created_at timestamptz not null default now(),
  constraint business_members_business_user_unique unique (business_id, user_id)
);

alter table business_members enable row level security;

create index idx_business_members_business_id on business_members(business_id);
create index idx_business_members_user_id on business_members(user_id);

create table business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  currency text not null default 'EUR' check (currency = 'EUR'),
  date_format date_format not null default 'DD/MM/YYYY',
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  tax_percentage numeric(5, 2) not null default 0 check (tax_percentage >= 0 and tax_percentage <= 100),
  notifications boolean not null default true,
  accepting_orders boolean not null default true,
  service_types jsonb not null default '{"pickup": true, "delivery": true, "dineIn": true}'::jsonb,
  opening_hours text not null default '' check (char_length(opening_hours) <= 500),
  order_timing_asap boolean not null default true,
  order_timing_scheduled boolean not null default true,
  order_timing_time_optional boolean not null default true,
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  min_order_amount integer not null default 0 check (min_order_amount >= 0),
  lead_time_value integer not null default 1 check (lead_time_value between 1 and 999),
  lead_time_unit text not null default 'business_days'
    check (lead_time_unit in ('minutes', 'hours', 'business_days')),
  revolut_revtag text not null default '',
  wero_identifier text not null default '',
  payment_methods jsonb not null default '{"cash": true, "revolut": true, "wero": true}'::jsonb,
  payment_instructions_en text not null default '' check (char_length(payment_instructions_en) <= 1000),
  payment_instructions_fr text not null default '' check (char_length(payment_instructions_fr) <= 1000),
  in_app_alerts boolean not null default true,
  sound_alerts boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint business_settings_business_id_unique unique (business_id)
);

alter table business_settings enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Product Catalog & Inventory
-- ----------------------------------------------------------------------------
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  sort_order integer not null default 0 check (sort_order >= 0),
  role category_role not null default 'regular',
  created_at timestamptz not null default now(),
  constraint product_categories_business_name_unique unique (business_id, name)
);

alter table product_categories enable row level security;

create index idx_product_categories_business_sort on product_categories(business_id, sort_order);

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  category_id uuid not null references product_categories(id) on delete restrict,
  name text not null check (char_length(trim(name)) >= 1),
  description text check (description is null or char_length(description) <= 1000),
  price integer not null check (price >= 0),
  unit_cost integer not null default 0 check (unit_cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  visible boolean not null default true,
  allergens text[] not null default '{}',
  suggest_add_ons boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products enable row level security;

create index idx_products_business_category on products(business_id, category_id);
create index idx_products_business_visible on products(business_id, visible);
create index idx_products_business_name on products(business_id, name);

-- ----------------------------------------------------------------------------
-- 3. Guests (Storefront Customers)
-- ----------------------------------------------------------------------------
create table guests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 50),
  phone text check (phone is null or phone ~ '^\+[1-9]\d{6,14}$'),
  email text check (email is null or email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  address text,
  notes text,
  created_at timestamptz not null default now()
);

alter table guests enable row level security;

create unique index idx_guests_business_phone_unique on guests(business_id, phone) where phone is not null;
create index idx_guests_business_created on guests(business_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Orders & Order Items
-- ----------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  order_number integer not null check (order_number > 0),
  guest_id uuid not null references guests(id) on delete restrict,
  submitted_name text check (submitted_name is null or char_length(trim(submitted_name)) between 2 and 50),
  service_type order_service_type not null,
  channel order_channel not null,
  status order_status not null default 'NEW',
  paid order_paid_status not null default 'unpaid',
  payment_preference order_payment_preference not null default 'on_handover',
  payment_method order_payment_method,
  paid_at timestamptz,
  refunded_at timestamptz,
  requested_date date not null,
  requested_time time,
  total_amount integer not null check (total_amount >= 0),
  tracking_token text not null default encode(gen_random_bytes(16), 'hex'),
  cancellation_reason text,
  notes text,
  delivery_address text,
  status_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_business_number_unique unique (business_id, order_number),
  constraint orders_tracking_token_unique unique (tracking_token),
  constraint orders_paid_consistency check (
    paid = 'unpaid' or (payment_method is not null and paid_at is not null)
  )
);

alter table orders enable row level security;

create index idx_orders_business_status on orders(business_id, status);
create index idx_orders_business_requested_date on orders(business_id, requested_date);
create index idx_orders_business_guest on orders(business_id, guest_id);
create index idx_orders_business_created on orders(business_id, created_at desc);
create index idx_orders_tracking_token on orders(tracking_token);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null check (char_length(trim(product_name)) >= 1),
  quantity integer not null check (quantity >= 1),
  unit_price integer not null check (unit_price >= 0),
  total_price integer not null check (total_price >= 0),
  created_at timestamptz not null default now()
);

alter table order_items enable row level security;

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_business_product on order_items(business_id, product_id);

-- ----------------------------------------------------------------------------
-- 5. Expenses
-- ----------------------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  amount integer not null check (amount >= 0),
  date date not null,
  description text not null check (char_length(trim(description)) >= 1),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

create index idx_expenses_business_date on expenses(business_id, date desc);
create index idx_expenses_tags_gin on expenses using gin (tags);

-- ----------------------------------------------------------------------------
-- 6. Updated_at Trigger Automation
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();

create trigger trigger_business_settings_updated_at
  before update on business_settings
  for each row execute function set_updated_at();

create trigger trigger_products_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger trigger_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();
