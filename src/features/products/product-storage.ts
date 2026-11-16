import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  uploadProductImage as uploadToStorage,
  deleteProductImage as deleteFromStorage,
} from "@/lib/supabase/storage";
import { parseProductImageDataUrl, extractProductImagePath } from "@/domain/product-image";

/**
 * Validates and uploads a product image to Supabase Storage under `<businessId>/<uuid>.<ext>`.
 * Returns the public URL for durable display.
 */
export async function uploadProductImage(
  businessId: string,
  input: { base64Data: string; fileName?: string },
  clientOverride?: SupabaseClient<Database>,
): Promise<string> {
  const parsed = parseProductImageDataUrl(input.base64Data);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const client = clientOverride ?? (await createClient());
  const path = `${businessId}/${crypto.randomUUID()}.${parsed.extension}`;

  return uploadToStorage(client, path, parsed.bytes, parsed.mimeType);
}

export const uploadProductImageToStorage = uploadProductImage;

/**
 * Removes an orphaned product image from Supabase Storage (Story #123, L4a).
 * - Best-effort: catches and logs errors without failing the caller action.
 * - Guarded: only attempts deletion if the URL belongs to the product-images bucket
 *   and starts with the caller's business folder.
 */
export async function removeProductImage(
  businessId: string,
  imageUrl: string | null | undefined,
  clientOverride?: SupabaseClient<Database>,
): Promise<void> {
  const path = extractProductImagePath(imageUrl, businessId);
  if (!path) {
    return;
  }

  try {
    const client = clientOverride ?? (await createClient());
    await deleteFromStorage(client, path);
  } catch (error) {
    // Best-effort orphan cleanup: log error without aborting caller operation
    console.warn(`Failed to remove product image (${path}) from storage:`, error);
  }
}
