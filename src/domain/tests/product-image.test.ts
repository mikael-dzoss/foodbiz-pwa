import { describe, expect, it } from "vitest";
import {
  parseProductImageDataUrl,
  extractProductImagePath,
  matchesMimeMagicBytes,
  PRODUCT_IMAGES_BUCKET,
  MAX_PRODUCT_IMAGE_BYTES,
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
} from "../product-image";

const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const validPngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const validWebpBytes = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
]);
const validAvifBytes = Buffer.from([
  0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0x00, 0x00, 0x00, 0x00,
  0x6d, 0x69, 0x66, 0x31,
]);
const validAvisBytes = Buffer.from([
  0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73, 0x00, 0x00, 0x00, 0x00,
  0x6d, 0x69, 0x66, 0x31,
]);
const validAvifCompatibleBytes = Buffer.from([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31, 0x00, 0x00, 0x00, 0x00,
  0x61, 0x76, 0x69, 0x66, 0x6d, 0x69, 0x61, 0x66,
]);

describe("Domain: Product Image Validation (#123, L4b, T4)", () => {
  describe("matchesMimeMagicBytes", () => {
    it("recognizes JPEG signature FF D8 FF", () => {
      expect(matchesMimeMagicBytes(validJpegBytes, "image/jpeg")).toBe(true);
      expect(matchesMimeMagicBytes(Buffer.from([0xff, 0xd8]), "image/jpeg")).toBe(false);
      expect(matchesMimeMagicBytes(validPngBytes, "image/jpeg")).toBe(false);
    });

    it("recognizes PNG signature 89 50 4E 47 0D 0A 1A 0A", () => {
      expect(matchesMimeMagicBytes(validPngBytes, "image/png")).toBe(true);
      expect(matchesMimeMagicBytes(validPngBytes.subarray(0, 7), "image/png")).toBe(false);
      expect(matchesMimeMagicBytes(validJpegBytes, "image/png")).toBe(false);
    });

    it("recognizes WebP signature RIFF....WEBP", () => {
      expect(matchesMimeMagicBytes(validWebpBytes, "image/webp")).toBe(true);
      expect(matchesMimeMagicBytes(validWebpBytes.subarray(0, 11), "image/webp")).toBe(false);
      // Alter 'WEBP' to 'TEST'
      const invalidWebp = Buffer.from(validWebpBytes);
      invalidWebp[8] = 0x54;
      expect(matchesMimeMagicBytes(invalidWebp, "image/webp")).toBe(false);
    });

    it("recognizes AVIF with brand avif or avis", () => {
      expect(matchesMimeMagicBytes(validAvifBytes, "image/avif")).toBe(true);
      expect(matchesMimeMagicBytes(validAvisBytes, "image/avif")).toBe(true);
      expect(matchesMimeMagicBytes(validAvifCompatibleBytes, "image/avif")).toBe(true);
      expect(matchesMimeMagicBytes(validAvifBytes.subarray(0, 10), "image/avif")).toBe(false);

      // Box without ftyp
      const notFtyp = Buffer.from(validAvifBytes);
      notFtyp[4] = 0x74;
      expect(matchesMimeMagicBytes(notFtyp, "image/avif")).toBe(false);

      // Ftyp box with unrelated brand
      const unrelatedBrand = Buffer.from([
        0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00,
        0x00, 0x69, 0x73, 0x6f, 0x6d,
      ]);
      expect(matchesMimeMagicBytes(unrelatedBrand, "image/avif")).toBe(false);
    });
  });

  describe("parseProductImageDataUrl", () => {
    it("exports expected allowed MIME types", () => {
      expect(ALLOWED_PRODUCT_IMAGE_MIME_TYPES).toEqual([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
      ]);
    });

    it("accepts valid data URLs with matching magic bytes for all supported formats", () => {
      const samples = [
        { mime: "image/jpeg", ext: "jpg", bytes: validJpegBytes },
        { mime: "image/png", ext: "png", bytes: validPngBytes },
        { mime: "image/webp", ext: "webp", bytes: validWebpBytes },
        { mime: "image/avif", ext: "avif", bytes: validAvifBytes },
      ] as const;

      for (const { mime, ext, bytes } of samples) {
        const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
        const res = parseProductImageDataUrl(dataUrl);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.mimeType).toBe(mime);
          expect(res.extension).toBe(ext);
          expect(res.bytes.byteLength).toBe(bytes.byteLength);
        }
      }
    });

    it("rejects non-data URLs", () => {
      const res = parseProductImageDataUrl("https://example.com/image.jpg");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/valid image data url/i);
      }
    });

    it("rejects disallowed MIME types even if payload looks like an image", () => {
      const disallowed = ["image/svg+xml", "image/gif", "application/pdf", "text/plain"];
      for (const mime of disallowed) {
        const dataUrl = `data:${mime};base64,${validPngBytes.toString("base64")}`;
        const res = parseProductImageDataUrl(dataUrl);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error).toMatch(/unsupported image format/i);
        }
      }
    });

    it("rejects empty base64 payload", () => {
      const res = parseProductImageDataUrl("data:image/jpeg;base64,");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/empty/i);
      }
    });

    it("rejects invalid base64 string", () => {
      const res = parseProductImageDataUrl("data:image/jpeg;base64,???not_base64!!!");
      expect(res.ok).toBe(false);
    });

    it("rejects mismatched MIME and magic bytes (JPEG header with PNG mime)", () => {
      const dataUrl = `data:image/png;base64,${validJpegBytes.toString("base64")}`;
      const res = parseProductImageDataUrl(dataUrl);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/binary signature does not match declared mime type/i);
      }
    });

    it("rejects truncated payloads for each format", () => {
      const truncatedCases = [
        { mime: "image/jpeg", bytes: Buffer.from([0xff, 0xd8]) },
        { mime: "image/png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]) },
        { mime: "image/webp", bytes: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]) },
        { mime: "image/avif", bytes: Buffer.from([0x00, 0x00, 0x00, 0x10, 0x66, 0x74]) },
      ] as const;

      for (const { mime, bytes } of truncatedCases) {
        const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
        const res = parseProductImageDataUrl(dataUrl);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error).toMatch(/binary signature does not match declared mime type/i);
        }
      }
    });

    it("rejects images larger than 5 MB limit", () => {
      // 5 MB + 1 byte with valid JPEG header
      const oversized = Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1);
      validJpegBytes.copy(oversized, 0);
      const dataUrl = `data:image/jpeg;base64,${oversized.toString("base64")}`;
      const res = parseProductImageDataUrl(dataUrl);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/exceeds maximum allowed size/i);
      }
    });

    it("accepts images at or under 5 MB with valid magic bytes", () => {
      const validSize = Buffer.alloc(10 * 1024); // 10 KB
      validPngBytes.copy(validSize, 0);
      const dataUrl = `data:image/png;base64,${validSize.toString("base64")}`;
      const res = parseProductImageDataUrl(dataUrl);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.bytes.byteLength).toBe(10 * 1024);
      }
    });
  });

  describe("extractProductImagePath (L4a orphan cleanup helper)", () => {
    const businessId = "11111111-1111-4111-8111-111111111111";

    it("extracts path from full Supabase storage public URL", () => {
      const url = `https://project.supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/photo-uuid.webp`;
      expect(extractProductImagePath(url, businessId)).toBe(`${businessId}/photo-uuid.webp`);
    });

    it("extracts path from local Supabase storage URL", () => {
      const url = `http://127.0.0.1:54321/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/croissant.jpg`;
      expect(extractProductImagePath(url, businessId)).toBe(`${businessId}/croissant.jpg`);
    });

    it("extracts path from relative bucket pathname", () => {
      const url = `/${PRODUCT_IMAGES_BUCKET}/${businessId}/item.png`;
      expect(extractProductImagePath(url, businessId)).toBe(`${businessId}/item.png`);
    });

    it("returns null if URL belongs to a different business ID", () => {
      const foreignBiz = "22222222-2222-4222-8222-222222222222";
      const url = `https://project.supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${foreignBiz}/photo.jpg`;
      expect(extractProductImagePath(url, businessId)).toBeNull();
    });

    it("returns null if URL belongs to a different bucket", () => {
      const url = `https://project.supabase.co/storage/v1/object/public/avatars/${businessId}/photo.jpg`;
      expect(extractProductImagePath(url, businessId)).toBeNull();
    });

    it("returns null for external or local static URLs", () => {
      expect(
        extractProductImagePath("https://images.unsplash.com/photo-123.jpg", businessId),
      ).toBeNull();
      expect(extractProductImagePath("/images/burger.jpg", businessId)).toBeNull();
      expect(extractProductImagePath("", businessId)).toBeNull();
      expect(extractProductImagePath(null, businessId)).toBeNull();
      expect(extractProductImagePath(undefined, businessId)).toBeNull();
    });

    it("returns null on directory traversal attempts", () => {
      const traversalUrl = `https://project.supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/../evil.jpg`;
      expect(extractProductImagePath(traversalUrl, businessId)).toBeNull();
    });

    it("returns null if path contains nested subdirectories", () => {
      const nestedUrl = `https://project.supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/subfolder/img.jpg`;
      expect(extractProductImagePath(nestedUrl, businessId)).toBeNull();
    });
  });
});
