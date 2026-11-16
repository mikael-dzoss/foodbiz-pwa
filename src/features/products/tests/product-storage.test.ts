import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { uploadProductImage, removeProductImage } from "../product-storage";
import { PRODUCT_IMAGES_BUCKET } from "@/domain/product-image";

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockUploadProductImage = vi.fn();
const mockDeleteProductImage = vi.fn();
vi.mock("@/lib/supabase/storage", () => ({
  uploadProductImage: (...args: unknown[]) => mockUploadProductImage(...args),
  deleteProductImage: (...args: unknown[]) => mockDeleteProductImage(...args),
}));

const validPngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const validPngDataUrl = `data:image/png;base64,${validPngBytes.toString("base64")}`;

describe("Product Storage Orchestration (#123, T4, L4a)", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadProductImage", () => {
    it("validates data URL and uploads to storage under business folder", async () => {
      const expectedUrl = `https://supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/abc.png`;
      mockUploadProductImage.mockResolvedValueOnce(expectedUrl);

      const fakeClient = {} as SupabaseClient<Database>;
      const url = await uploadProductImage(
        businessId,
        { base64Data: validPngDataUrl, fileName: "croissant.png" },
        fakeClient,
      );

      expect(url).toBe(expectedUrl);
      expect(mockUploadProductImage).toHaveBeenCalledWith(
        fakeClient,
        expect.stringMatching(new RegExp(`^${businessId}/[0-9a-fA-F-]+\\.png$`)),
        expect.any(Uint8Array),
        "image/png",
      );
    });

    it("throws when image validation fails", async () => {
      await expect(uploadProductImage(businessId, { base64Data: "invalid-data" })).rejects.toThrow(
        /valid image data url/i,
      );

      expect(mockUploadProductImage).not.toHaveBeenCalled();
    });

    it("uses createClient() when clientOverride is not provided", async () => {
      const serverClient = { id: "server-client" };
      mockCreateClient.mockResolvedValueOnce(serverClient);
      mockUploadProductImage.mockResolvedValueOnce("https://example.com/img.png");

      await uploadProductImage(businessId, { base64Data: validPngDataUrl });

      expect(mockCreateClient).toHaveBeenCalled();
      expect(mockUploadProductImage).toHaveBeenCalledWith(
        serverClient,
        expect.any(String),
        expect.any(Uint8Array),
        "image/png",
      );
    });
  });

  describe("removeProductImage (orphan cleanup)", () => {
    it("deletes object when URL belongs to caller's business and product-images bucket", async () => {
      const fakeClient = {} as SupabaseClient<Database>;
      const targetUrl = `https://supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/old-img.png`;

      await removeProductImage(businessId, targetUrl, fakeClient);

      expect(mockDeleteProductImage).toHaveBeenCalledWith(fakeClient, `${businessId}/old-img.png`);
    });

    it("ignores URLs that belong to a different business folder", async () => {
      const foreignBiz = "22222222-2222-4222-8222-222222222222";
      const targetUrl = `https://supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${foreignBiz}/other.png`;

      await removeProductImage(businessId, targetUrl);

      expect(mockDeleteProductImage).not.toHaveBeenCalled();
    });

    it("ignores external or static URLs safely", async () => {
      await removeProductImage(businessId, "https://unsplash.com/photo.jpg");
      await removeProductImage(businessId, "/images/burger.jpg");
      await removeProductImage(businessId, null);
      await removeProductImage(businessId, undefined);

      expect(mockDeleteProductImage).not.toHaveBeenCalled();
    });

    it("catches storage errors and never throws (best-effort)", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockDeleteProductImage.mockRejectedValueOnce(new Error("Storage service unavailable"));

      const targetUrl = `https://supabase.co/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${businessId}/fail.png`;
      const fakeClient = {} as SupabaseClient<Database>;

      await expect(removeProductImage(businessId, targetUrl, fakeClient)).resolves.toBeUndefined();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to remove product image (${businessId}/fail.png)`),
        expect.any(Error),
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
