import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { createClient } from "./server";

export const PRODUCT_IMAGES_BUCKET = "product-images";
export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (5,242,880 bytes)

export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedProductImageMimeType = (typeof ALLOWED_PRODUCT_IMAGE_MIME_TYPES)[number];

export const MIME_TO_EXTENSION: Record<AllowedProductImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type ParsedProductImage =
  | {
      ok: true;
      mimeType: AllowedProductImageMimeType;
      extension: string;
      bytes: Uint8Array;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Validates a base64 image data URL, checking MIME type, non-empty payload,
 * and maximum file size (5 MB limit).
 */
export function parseProductImageDataUrl(base64Data: string): ParsedProductImage {
  const match = /^data:([^;,]+);base64,(.*)$/.exec(base64Data);
  if (!match) {
    return { ok: false, error: "Uploaded file must be a valid image data URL." };
  }

  const [, mimeTypeRaw, payload] = match;
  const mimeType = mimeTypeRaw.toLowerCase();

  if (!ALLOWED_PRODUCT_IMAGE_MIME_TYPES.includes(mimeType as AllowedProductImageMimeType)) {
    return {
      ok: false,
      error: `Unsupported image format (${mimeType}). Allowed formats: ${ALLOWED_PRODUCT_IMAGE_MIME_TYPES.join(", ")}.`,
    };
  }

  if (!payload || payload.trim() === "") {
    return { ok: false, error: "Image file is empty." };
  }

  let bytes: Uint8Array;
  try {
    const buffer = Buffer.from(payload, "base64");
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } catch {
    return { ok: false, error: "Invalid base64 payload." };
  }

  if (bytes.byteLength === 0) {
    return { ok: false, error: "Image file is empty." };
  }

  if (bytes.byteLength > MAX_PRODUCT_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image exceeds maximum allowed size of 5 MB (${bytes.byteLength} bytes).`,
    };
  }

  const extension = MIME_TO_EXTENSION[mimeType as AllowedProductImageMimeType];

  return {
    ok: true,
    mimeType: mimeType as AllowedProductImageMimeType,
    extension,
    bytes,
  };
}

/**
 * Uploads a validated product image to the `product-images` bucket under `<business_id>/<uuid>.<ext>`.
 * Returns the public URL for durable display.
 */
export async function uploadProductImageToStorage(
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

  const { data, error } = await client.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, parsed.bytes, {
      contentType: parsed.mimeType,
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
