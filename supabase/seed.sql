-- ============================================================================
-- Supabase Local Seed Data: Demo Business, Settings, Categories, Products (#120 / N1)
-- Description: Seeds one demo business aligned with the mock repository fixtures
--              (DEMO_BUSINESS_ID) and default catalog for local development.
--              Membership (auth.users, business_members) is deliberately omitted
--              here and provisioned via scripts/provision-member.mjs.
-- ============================================================================

-- 1. Demo Business
insert into public.businesses (
  id,
  name,
  slug,
  currency,
  description,
  phone,
  email,
  whatsapp_number,
  instagram_url,
  facebook_url,
  address,
  latitude,
  longitude,
  logo_url
) values (
  '11111111-1111-4111-8111-111111111111'::uuid,
  'La Petite Boulangerie',
  'la-petite-boulangerie',
  'EUR',
  'Artisanal organic sourdough bakery and French pastries in Paris.',
  '+33 1 43 55 67 89',
  'bonjour@lapetiteboulangerie.fr',
  '+33 6 12 34 56 78',
  'https://instagram.com/lapetiteboulangerie',
  'https://facebook.com/lapetiteboulangerie',
  '12 Rue de la Roquette, 75011 Paris, France',
  48.8553,
  2.3726,
  null
) on conflict (id) do nothing;

-- 2. Business Settings
insert into public.business_settings (
  id,
  business_id,
  currency,
  date_format,
  low_stock_threshold,
  tax_percentage,
  notifications,
  accepting_orders,
  service_types,
  opening_hours,
  order_timing_asap,
  order_timing_scheduled,
  order_timing_time_optional,
  delivery_fee,
  min_order_amount,
  lead_time_value,
  lead_time_unit,
  revolut_revtag,
  wero_identifier,
  payment_methods,
  payment_instructions_en,
  payment_instructions_fr,
  in_app_alerts,
  sound_alerts
) values (
  '11111111-1111-4111-8111-111111111112'::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  'EUR',
  'DD/MM/YYYY',
  5,
  5.50,
  true,
  true,
  '{"pickup": true, "delivery": true, "dineIn": true}'::jsonb,
  'Mon-Sat: 07:00 - 19:30, Sun: 08:00 - 13:00',
  true,
  true,
  true,
  350,
  1500,
  1,
  'business_days',
  '@boulangerie',
  '+33612345678',
  '{"cash": true, "revolut": true, "wero": true}'::jsonb,
  'Questions about payment? Message us on WhatsApp.',
  'Une question sur le paiement ? Écrivez-nous sur WhatsApp.',
  true,
  true
) on conflict (business_id) do nothing;

-- 3. Product Categories
insert into public.product_categories (
  id,
  business_id,
  name,
  sort_order,
  role
) values
  ('22222222-2222-4222-8222-222222222201'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'Breads & Baguettes', 1, 'regular'),
  ('22222222-2222-4222-8222-222222222202'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'Pastries & Viennoiserie', 2, 'regular'),
  ('22222222-2222-4222-8222-222222222203'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'Hot & Cold Beverages', 3, 'drinks'),
  ('22222222-2222-4222-8222-222222222204'::uuid, '11111111-1111-4111-8111-111111111111'::uuid, 'Snacks', 4, 'snacks')
on conflict (id) do nothing;

-- 4. Products
insert into public.products (
  id,
  business_id,
  category_id,
  name,
  description,
  allergens,
  price,
  unit_cost,
  stock,
  visible,
  suggest_add_ons,
  image_url
) values
  (
    '33333333-3333-4333-8333-333333333301'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222201'::uuid,
    'Traditional Baguette',
    'Crispy crust and airy crumb made with long fermentation',
    array['gluten'],
    130,
    35,
    45,
    true,
    true,
    '/images/baguette.jpg'
  ),
  (
    '33333333-3333-4333-8333-333333333302'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222201'::uuid,
    'Country Sourdough Loaf',
    'Naturally leavened sourdough loaf with deep rustic flavor',
    array['gluten'],
    450,
    120,
    20,
    true,
    true,
    '/images/sourdough.jpg'
  ),
  (
    '33333333-3333-4333-8333-333333333306'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222202'::uuid,
    'Butter Croissant',
    'Classic golden, flaky croissant made with pure Normandy butter',
    array['gluten', 'milk', 'eggs'],
    160,
    45,
    35,
    true,
    true,
    '/images/croissant.jpg'
  ),
  (
    '33333333-3333-4333-8333-333333333313'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222203'::uuid,
    'Double Espresso',
    'Locally roasted specialty Arabica blend espresso',
    array[]::text[],
    220,
    35,
    50,
    true,
    true,
    '/images/espresso.jpg'
  ),
  (
    '33333333-3333-4333-8333-333333333316'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222204'::uuid,
    'Madeleines x3',
    '',
    array['gluten', 'milk', 'eggs'],
    300,
    0,
    20,
    true,
    true,
    null
  )
on conflict (id) do nothing;
