import { describe, expect, it, vi } from "vitest";
import {
  parseProductImageDataUrl,
  uploadProductImageToStorage,
  PRODUCT_IMAGES_BUCKET,
  MAX_PRODUCT_IMAGE_BYTES,
  ALLOWED_PRODUCT_IMAGE_MIME_TYPES,
} from "../storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

const mockCreateClient = vi.fn();
vi.mock("../server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("Supabase Storage product images (#123)", () => {
  describe("parseProductImageDataUrl", () => {
    it("exports expected allowed MIME types", () => {
      expect(ALLOWED_PRODUCT_IMAGE_MIME_TYPES).toEqual([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
      ]);
    });

    it("accepts all allowed MIME types", () => {
      const allowed = [
        { mime: "image/jpeg", ext: "jpg" },
        { mime: "image/png", ext: "png" },
        { mime: "image/webp", ext: "webp" },
        { mime: "image/avif", ext: "avif" },
      ] as const;

      for (const { mime, ext } of allowed) {
        const payload = Buffer.from("tiny-valid-pixel").toString("base64");
        const res = parseProductImageDataUrl(`data:${mime};base64,${payload}`);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.mimeType).toBe(mime);
          expect(res.extension).toBe(ext);
          expect(res.bytes.byteLength).toBeGreaterThan(0);
        }
      }
    });

    it("rejects non-data URLs", () => {
      const res = parseProductImageDataUrl("not-an-image-data-url");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/valid image data url/i);
      }
    });

    it("rejects disallowed MIME types (svg, gif, pdf)", () => {
      const disallowed = ["image/svg+xml", "image/gif", "application/pdf", "text/plain"];

      for (const mime of disallowed) {
        const payload = Buffer.from("sample").toString("base64");
        const res = parseProductImageDataUrl(`data:${mime};base64,${payload}`);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.error).toMatch(/unsupported image format/i);
        }
      }
    });

    it("rejects empty payloads", () => {
      const res = parseProductImageDataUrl("data:image/png;base64,");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/empty/i);
      }
    });

    it("rejects images larger than 5 MB limit", () => {
      // 5 MB + 1 byte
      const oversizedBuffer = Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1, 1);
      const oversizedBase64 = `data:image/jpeg;base64,${oversizedBuffer.toString("base64")}`;

      const res = parseProductImageDataUrl(oversizedBase64);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/exceeds maximum allowed size/i);
      }
    });

    it("accepts images at or under the 5 MB limit", () => {
      const validBuffer = Buffer.alloc(1024, 1); // 1 KB
      const res = parseProductImageDataUrl(
        `data:image/webp;base64,${validBuffer.toString("base64")}`,
      );
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.bytes.byteLength).toBe(1024);
      }
    });
  });

  describe("uploadProductImageToStorage", () => {
    const businessId = "10000000-0000-0000-0000-000000000001";
    const samplePayload = Buffer.from("croissant-bytes").toString("base64");
    const validDataUrl = `data:image/webp;base64,${samplePayload}`;

    it("uploads image to storage and returns public URL", async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: `${businessId}/test-file.webp` },
        error: null,
      });
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: {
          publicUrl: `https://example-supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/test-file.webp`,
        },
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            getPublicUrl: mockGetPublicUrl,
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const publicUrl = await uploadProductImageToStorage(
        businessId,
        { base64Data: validDataUrl },
        mockClient,
      );

      expect(mockClient.storage.from).toHaveBeenCalledWith(PRODUCT_IMAGES_BUCKET);
      expect(mockUpload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^${businessId}/[0-9a-fA-F-]+\\.webp$`)),
        expect.any(Uint8Array),
        { contentType: "image/webp", upsert: false },
      );
      expect(mockGetPublicUrl).toHaveBeenCalled();
      expect(publicUrl).toBe(
        `https://example-supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/test-file.webp`,
      );
    });

    it("throws when parseProductImageDataUrl fails", async () => {
      await expect(
        uploadProductImageToStorage(businessId, { base64Data: "invalid" }),
      ).rejects.toThrow(/valid image data url/i);
    });

    it("throws when storage upload returns an error", async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Storage bucket not accessible"),
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
          }),
        },
      } as unknown as SupabaseClient<Database>;

      await expect(
        uploadProductImageToStorage(businessId, { base64Data: validDataUrl }, mockClient),
      ).rejects.toThrow(/Storage bucket not accessible/i);
    });

    it("uses default createClient() when clientOverride is not passed", async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: `${businessId}/default.png` },
        error: null,
      });
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: "https://example.com/default.png" },
      });

      mockCreateClient.mockResolvedValue({
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            getPublicUrl: mockGetPublicUrl,
          }),
        },
      });

      const pngDataUrl = `data:image/png;base64,${Buffer.from("png").toString("base64")}`;
      const url = await uploadProductImageToStorage(businessId, { base64Data: pngDataUrl });

      expect(mockCreateClient).toHaveBeenCalled();
      expect(url).toBe("https://example.com/default.png");
    });
  });
});
