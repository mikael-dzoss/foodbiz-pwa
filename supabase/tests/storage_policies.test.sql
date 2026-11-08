-- ============================================================================
-- Test Suite: storage_policies.test.sql (#123)
-- Description: pgTAP tests verifying Supabase Storage bucket configuration
--              and RLS policies for product-images (public read, member write,
--              tenant isolation by business ID prefix).
-- ============================================================================

begin;

create extension if not exists pgtap;

select plan(23);

-- ----------------------------------------------------------------------------
-- Test Seeds and Role Permissions
-- ----------------------------------------------------------------------------

-- 1. Ensure table grants for standard Supabase API roles
do $$
begin
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on table storage.objects to anon, authenticated;
  grant select on table storage.buckets to anon, authenticated;
exception when others then
  null;
end $$;

-- 2. Auth users
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'authenticated', 'authenticated', 'member_a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'authenticated', 'authenticated', 'non_member@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

-- 3. Businesses
insert into public.businesses (id, name, slug, currency)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Business A', 'biz-a', 'EUR'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Business B', 'biz-b', 'EUR')
on conflict (id) do nothing;

-- 4. Business Members
insert into public.business_members (id, business_id, user_id, role)
values
  ('ba000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner')
on conflict (business_id, user_id) do nothing;

-- 5. Seed initial objects into storage.objects
insert into storage.objects (id, bucket_id, name, owner)
values
  ('ea000000-0000-0000-0000-000000000001'::uuid, 'product-images', '10000000-0000-0000-0000-000000000001/seed-croissant.webp', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  ('eb000000-0000-0000-0000-000000000001'::uuid, 'product-images', '20000000-0000-0000-0000-000000000002/seed-pain-au-chocolat.webp', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Section 1: Storage Bucket Configuration (Tests 1-4)
-- ----------------------------------------------------------------------------

select is(
  (select count(*)::int from storage.buckets where id = 'product-images'),
  1,
  'product-images bucket exists'
);

select is(
  (select public from storage.buckets where id = 'product-images'),
  true,
  'product-images bucket is public'
);

select is(
  (select file_size_limit from storage.buckets where id = 'product-images'),
  5242880::bigint,
  'product-images file_size_limit is 5 MB (5242880 bytes)'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'product-images'),
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  'product-images allowed_mime_types are jpeg, png, webp, avif'
);

-- ----------------------------------------------------------------------------
-- Section 2: Helper Function Unit Tests (Tests 5-9)
-- ----------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(
  public.can_manage_product_image('10000000-0000-0000-0000-000000000001/croissant.webp'),
  true,
  'member_a can manage image under Biz A prefix'
);

select is(
  public.can_manage_product_image('20000000-0000-0000-0000-000000000002/croissant.webp'),
  false,
  'member_a cannot manage image under Biz B prefix'
);

select is(
  public.can_manage_product_image('invalid-uuid/croissant.webp'),
  false,
  'invalid UUID prefix returns false'
);

select is(
  public.can_manage_product_image('croissant.webp'),
  false,
  'root path without folder prefix returns false'
);

select is(
  public.can_manage_product_image(''),
  false,
  'empty path returns false'
);

-- ----------------------------------------------------------------------------
-- Section 3: Anonymous Role Access (Tests 10-13)
-- ----------------------------------------------------------------------------

set local role anon;
reset "request.jwt.claim.sub";
reset "request.jwt.claims";

select is(
  (select count(*)::int from storage.objects where bucket_id = 'product-images'),
  2,
  'anon can select objects in product-images'
);

select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''ea000000-0000-0000-0000-000000000002'', ''product-images'', ''10000000-0000-0000-0000-000000000001/anon.webp'')',
  '42501',
  null,
  'anon is denied insert in product-images'
);

update storage.objects set name = '10000000-0000-0000-0000-000000000001/updated.webp' where id = 'ea000000-0000-0000-0000-000000000001';
select is(
  (select name from storage.objects where id = 'ea000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001/seed-croissant.webp',
  'anon is denied update in product-images'
);

select throws_ok(
  'delete from storage.objects where id = ''ea000000-0000-0000-0000-000000000001''',
  '42501',
  null,
  'anon is denied delete in product-images'
);

-- ----------------------------------------------------------------------------
-- Section 4: Authenticated Business Member Access (Tests 14-20)
-- ----------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

select lives_ok(
  'insert into storage.objects (id, bucket_id, name) values (''ea000000-0000-0000-0000-000000000003'', ''product-images'', ''10000000-0000-0000-0000-000000000001/croissant.webp'')',
  'member_a can insert image under Biz A folder'
);

select lives_ok(
  'update storage.objects set name = ''10000000-0000-0000-0000-000000000001/croissant-v2.webp'' where id = ''ea000000-0000-0000-0000-000000000003''',
  'member_a can update image in Biz A folder'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'product_images_delete_member' and cmd = 'DELETE' and public.can_manage_product_image('10000000-0000-0000-0000-000000000001/croissant-v2.webp')),
  1,
  'member_a can delete image in Biz A folder'
);

select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''ea000000-0000-0000-0000-000000000004'', ''product-images'', ''20000000-0000-0000-0000-000000000002/croissant.webp'')',
  '42501',
  null,
  'member_a is denied insert into Biz B folder'
);

select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''ea000000-0000-0000-0000-000000000005'', ''product-images'', ''root-croissant.webp'')',
  '42501',
  null,
  'member_a is denied insert at bucket root'
);

update storage.objects set name = '20000000-0000-0000-0000-000000000002/hacked.webp' where id = 'eb000000-0000-0000-0000-000000000001';
select is(
  (select name from storage.objects where id = 'eb000000-0000-0000-0000-000000000001'),
  '20000000-0000-0000-0000-000000000002/seed-pain-au-chocolat.webp',
  'member_a is denied update on Biz B object'
);

select throws_ok(
  'delete from storage.objects where id = ''eb000000-0000-0000-0000-000000000001''',
  '42501',
  null,
  'member_a is denied delete on Biz B object'
);

-- ----------------------------------------------------------------------------
-- Section 5: Authenticated Non-Member Access (Tests 21-23)
-- ----------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "authenticated"}';

select throws_ok(
  'insert into storage.objects (id, bucket_id, name) values (''ea000000-0000-0000-0000-000000000006'', ''product-images'', ''10000000-0000-0000-0000-000000000001/unauthorized.webp'')',
  '42501',
  null,
  'non-member is denied insert into Biz A folder'
);

update storage.objects set name = '10000000-0000-0000-0000-000000000001/unauthorized-up.webp' where id = 'ea000000-0000-0000-0000-000000000001';
select is(
  (select name from storage.objects where id = 'ea000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000001/seed-croissant.webp',
  'non-member is denied update on Biz A object'
);

select throws_ok(
  'delete from storage.objects where id = ''ea000000-0000-0000-0000-000000000001''',
  '42501',
  null,
  'non-member is denied delete on Biz A object'
);

-- Finish pgTAP suite and rollback seeded data
select * from finish();
rollback;
