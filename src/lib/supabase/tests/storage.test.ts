import { describe, expect, it, vi } from "vitest";
import { uploadProductImage, deleteProductImage, PRODUCT_IMAGES_BUCKET } from "../storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

describe("Supabase Storage thin client helpers (#123, T4)", () => {
  const businessId = "10000000-0000-0000-0000-000000000001";
  const path = `${businessId}/test-file.webp`;
  const sampleBytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);

  describe("uploadProductImage", () => {
    it("uploads bytes to product-images bucket and returns public URL", async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path },
        error: null,
      });
      const expectedUrl = `https://example-supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
      const mockGetPublicUrl = vi.fn().mockReturnValue({
        data: { publicUrl: expectedUrl },
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            upload: mockUpload,
            getPublicUrl: mockGetPublicUrl,
          }),
        },
      } as unknown as SupabaseClient<Database>;

      const publicUrl = await uploadProductImage(mockClient, path, sampleBytes, "image/webp");

      expect(mockClient.storage.from).toHaveBeenCalledWith(PRODUCT_IMAGES_BUCKET);
      expect(mockUpload).toHaveBeenCalledWith(path, sampleBytes, {
        contentType: "image/webp",
        upsert: false,
      });
      expect(mockGetPublicUrl).toHaveBeenCalledWith(path);
      expect(publicUrl).toBe(expectedUrl);
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

      await expect(uploadProductImage(mockClient, path, sampleBytes, "image/webp")).rejects.toThrow(
        /Storage bucket not accessible/i,
      );
    });
  });

  describe("deleteProductImage", () => {
    it("calls remove on product-images bucket with given path", async () => {
      const mockRemove = vi.fn().mockResolvedValue({
        data: [{ name: path }],
        error: null,
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            remove: mockRemove,
          }),
        },
      } as unknown as SupabaseClient<Database>;

      await deleteProductImage(mockClient, path);

      expect(mockClient.storage.from).toHaveBeenCalledWith(PRODUCT_IMAGES_BUCKET);
      expect(mockRemove).toHaveBeenCalledWith([path]);
    });

    it("throws when storage remove returns an error", async () => {
      const mockRemove = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Permission denied deleting object"),
      });

      const mockClient = {
        storage: {
          from: vi.fn().mockReturnValue({
            remove: mockRemove,
          }),
        },
      } as unknown as SupabaseClient<Database>;

      await expect(deleteProductImage(mockClient, path)).rejects.toThrow(
        /Permission denied deleting object/i,
      );
    });
  });
});
