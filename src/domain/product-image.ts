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
 * Validates binary signature (magic bytes) against the declared MIME type.
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
 * - AVIF: box type 'ftyp' (bytes 4-7) with brand 'avif' or 'avis'
 */
export function matchesMimeMagicBytes(
  bytes: Uint8Array,
  mimeType: AllowedProductImageMimeType,
): boolean {
  switch (mimeType) {
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    case "image/png":
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );

    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 && // R
        bytes[1] === 0x49 && // I
        bytes[2] === 0x46 && // F
        bytes[3] === 0x46 && // F
        bytes[8] === 0x57 && // W
        bytes[9] === 0x45 && // E
        bytes[10] === 0x42 && // B
        bytes[11] === 0x50 // P
      );

    case "image/avif": {
      if (bytes.length < 12) return false;
      // bytes 4-7 must be ASCII 'ftyp' (0x66, 0x74, 0x79, 0x70)
      const hasFtyp =
        bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
      if (!hasFtyp) return false;

      // Box length is in big-endian 32-bit int at offset 0
      const boxSize = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
      const limit = Math.min(boxSize > 0 ? boxSize : bytes.length, bytes.length);

      // Search 4-byte aligned brands starting at offset 8 (major brand, then compatible brands)
      for (let offset = 8; offset + 4 <= limit; offset += 4) {
        if (offset === 12) continue; // skip minor_version (offset 12-15)
        const brand = String.fromCharCode(
          bytes[offset],
          bytes[offset + 1],
          bytes[offset + 2],
          bytes[offset + 3],
        );
        if (brand === "avif" || brand === "avis") {
          return true;
        }
      }
      return false;
    }
  }
}

/**
 * Validates a base64 image data URL, checking MIME type, non-empty payload,
 * maximum file size (5 MB limit), and binary signature (magic bytes).
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

  const typedMime = mimeType as AllowedProductImageMimeType;
  if (!matchesMimeMagicBytes(bytes, typedMime)) {
    return {
      ok: false,
      error: `Image binary signature does not match declared MIME type (${typedMime}).`,
    };
  }

  const extension = MIME_TO_EXTENSION[typedMime];

  return {
    ok: true,
    mimeType: typedMime,
    extension,
    bytes,
  };
}

/**
 * Safely extracts the internal storage object path (`<businessId>/<fileName>`)
 * from a product image URL if and only if it belongs to the `product-images` bucket
 * and the caller's business folder.
 * Returns null if the URL is external, points to another tenant or bucket, or is invalid.
 */
export function extractProductImagePath(
  imageUrl: string | null | undefined,
  businessId: string,
): string | null {
  if (!imageUrl || typeof imageUrl !== "string") {
    return null;
  }

  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl).pathname;
  } catch {
    // Relative or invalid URL; use string as-is
  }

  const expectedPrefix = `/${PRODUCT_IMAGES_BUCKET}/${businessId}/`;
  const prefixIdx = pathname.indexOf(expectedPrefix);
  if (prefixIdx === -1) {
    return null;
  }

  const fileName = pathname.slice(prefixIdx + expectedPrefix.length);
  // Ensure fileName is safe (single path segment, no traversals or invalid chars)
  if (!fileName || fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) {
    return null;
  }

  if (!/^[0-9a-zA-Z._-]+$/.test(fileName)) {
    return null;
  }

  return `${businessId}/${fileName}`;
}
