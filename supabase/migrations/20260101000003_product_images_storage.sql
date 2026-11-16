-- ============================================================================
-- Migration: 20260101000003_product_images_storage.sql
-- Description: Supabase Storage bucket configuration and Row Level Security
--              policies for product images (#123).
--
-- Rollback note (development/emergency only; production migrations are forward-only):
--   drop policy if exists product_images_delete_member on storage.objects;
--   drop policy if exists product_images_update_member on storage.objects;
--   drop policy if exists product_images_insert_member on storage.objects;
--   drop policy if exists product_images_select_member on storage.objects;
--   drop policy if exists product_images_select_public on storage.objects;
--   drop function if exists public.can_manage_product_image(text);
--   delete from storage.buckets where id = 'product-images';
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configure Storage Bucket
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB (5 * 1024 * 1024)
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Storage Helper Function: can_manage_product_image
-- ----------------------------------------------------------------------------

create or replace function public.can_manage_product_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then public.is_business_member((split_part(object_name, '/', 1))::uuid)
    else false
  end;
$$;

revoke all on function public.can_manage_product_image(text) from public, anon;
revoke execute on function public.can_manage_product_image(text) from anon;
grant execute on function public.can_manage_product_image(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Row Level Security Policies on storage.objects
-- ----------------------------------------------------------------------------

-- Note: RLS is enabled by default on storage.objects in Supabase Storage.
-- Public read of image content is served directly by the public bucket URL without requiring SELECT on storage.objects.
-- Member select: Authenticated members can list/read objects in their business folder (<business_id>/*)
create policy product_images_select_member
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.can_manage_product_image(name));

-- Member upload: Authenticated members can only upload to their business folder (<business_id>/*)
create policy product_images_insert_member
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.can_manage_product_image(name));

-- Member update: Authenticated members can only update files in their business folder (<business_id>/*)
create policy product_images_update_member
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.can_manage_product_image(name))
  with check (bucket_id = 'product-images' and public.can_manage_product_image(name));

-- Member delete: Authenticated members can only delete files in their business folder (<business_id>/*)
create policy product_images_delete_member
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.can_manage_product_image(name));
