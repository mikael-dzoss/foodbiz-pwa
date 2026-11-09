import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { PRODUCT_IMAGES_BUCKET } from "@/domain/product-image";

export { PRODUCT_IMAGES_BUCKET };
export * from "@/domain/product-image";

/**
 * Thin storage helper: uploads binary payload to the product-images bucket
 * and returns the public URL.
 */
export async function uploadProductImage(
  client: SupabaseClient<Database>,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const { data, error } = await client.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload product image: ${error.message}`);
  }

  const { data: publicUrlData } = client.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .getPublicUrl(data?.path ?? path);

  return publicUrlData.publicUrl;
}

/**
 * Thin storage helper: removes an object from the product-images bucket.
 */
export async function deleteProductImage(
  client: SupabaseClient<Database>,
  path: string,
): Promise<void> {
  const { error } = await client.storage.from(PRODUCT_IMAGES_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Failed to delete product image: ${error.message}`);
  }
}
