import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CreateProductInput, UpdateProductInput, Product } from "@/domain";
import { listProducts } from "../product-data";
import {
  createProductAction,
  updateProductAction,
  toggleProductVisibilityAction,
  softDeleteProductAction,
  adjustProductStockAction,
  uploadProductImageAction,
} from "../product-actions";

const mockRevalidatePath = vi.fn();
const mockUpdateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) =>
    type ? mockRevalidatePath(path, type) : mockRevalidatePath(path),
  updateTag: (tag: string) => mockUpdateTag(tag),
}));

const mockUploadProductImage = vi.fn();
const mockRemoveProductImage = vi.fn();
vi.mock("../product-storage", () => ({
  uploadProductImage: (...args: unknown[]) => mockUploadProductImage(...args),
  uploadProductImageToStorage: (...args: unknown[]) => mockUploadProductImage(...args),
  removeProductImage: (...args: unknown[]) => mockRemoveProductImage(...args),
}));

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const validCategoryId = "22222222-2222-4222-8222-222222222201";
const validProductId = "33333333-3333-4333-8333-333333333301";

const mockProducts: Product[] = [
  {
    id: validProductId,
    businessId: testBusinessId,
    categoryId: validCategoryId,
    name: "Burger Gourmet",
    description: "Tasty burger",
    price: 1250,
    unitCost: 420,
    stock: 18,
    visible: true,
    allergens: ["gluten"],
    suggestAddOns: false,
    imageUrl: "/images/burger.jpg",
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z",
  },
];

const mockCategories = [
  {
    id: validCategoryId,
    businessId: testBusinessId,
    name: "Plats",
    sortOrder: 1,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];

const mockProductRepo = {
  list: vi.fn(async () => [...mockProducts]),
  findById: vi.fn(
    async (_bId: string, id: string) => mockProducts.find((p) => p.id === id) ?? null,
  ),
  create: vi.fn(async (_bId: string, input: CreateProductInput) => ({
    id: "33333333-3333-4333-8333-333333333399",
    businessId: testBusinessId,
    name: input.name,
    categoryId: input.categoryId,
    description: input.description ?? null,
    price: input.price,
    unitCost: input.unitCost ?? 0,
    stock: input.stock ?? 0,
    visible: input.visible ?? true,
    allergens: input.allergens ?? [],
    suggestAddOns: input.suggestAddOns ?? true,
    imageUrl: input.imageUrl ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  update: vi.fn(async (_bId: string, id: string, input: UpdateProductInput) => {
    const existing = mockProducts.find((p) => p.id === id);
    return {
      ...(existing ?? mockProducts[0]),
      ...input,
      updatedAt: new Date().toISOString(),
    };
  }),
  softDelete: vi.fn(async (_bId: string, id: string) => {
    const existing = mockProducts.find((p) => p.id === id);
    return {
      ...(existing ?? mockProducts[0]),
      visible: false,
      updatedAt: new Date().toISOString(),
    };
  }),
};

const mockCategoryRepo = {
  list: vi.fn(async () => [...mockCategories]),
  findById: vi.fn(
    async (_bId: string, id: string) => mockCategories.find((c) => c.id === id) ?? null,
  ),
};

const mockBusinessRepo = {
  getSettings: vi.fn(async () => ({
    businessId: testBusinessId,
    lowStockThreshold: 5,
    currency: "EUR",
    dateFormat: "DD/MM/YYYY",
    taxPercentage: 0,
    notifications: true,
  })),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    products: mockProductRepo,
    categories: mockCategoryRepo,
    business: mockBusinessRepo,
  }),
}));

const mockRequireAuthenticatedAction = vi.fn(async () => ({
  session: {
    user: { id: "user-1", email: "manager@test.com" },
    business: { id: testBusinessId, name: "Test Biz", slug: "test-biz" },
    role: "manager" as const,
  },
  businessId: testBusinessId,
}));

vi.mock("@/features/auth", () => ({
  requireAuthenticatedAction: () => mockRequireAuthenticatedAction(),
}));

describe("Product Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listProducts (data module)", () => {
    it("returns enriched products with category names and low stock threshold", async () => {
      const res = await listProducts();
      expect(res.products).toHaveLength(1);
      expect(res.products[0].name).toBe("Burger Gourmet");
      expect(res.products[0].categoryName).toBe("Plats");
      expect(res.lowStockThreshold).toBe(5);
      expect(res.categories).toHaveLength(1);
    });

    it("falls back to the default threshold and an Uncategorized label", async () => {
      mockBusinessRepo.getSettings.mockResolvedValueOnce(null as never);
      mockCategoryRepo.list.mockResolvedValueOnce([]);
      const res = await listProducts();
      expect(res.lowStockThreshold).toBe(5);
      expect(res.products[0].categoryName).toBe("Uncategorized");
    });

    it("throws on repository failure instead of returning an empty list", async () => {
      mockProductRepo.list.mockRejectedValueOnce(new Error("Offline"));
      await expect(listProducts()).rejects.toThrow("Offline");
    });
  });

  describe("createProductAction", () => {
    it("defaults, persists and validates add-on suggestions on create and update", async () => {
      const input = { name: "Bread", categoryId: validCategoryId, price: 100 };
      expect(await createProductAction(input)).toMatchObject({
        ok: true,
        data: { suggestAddOns: true },
      });
      expect(await createProductAction({ ...input, suggestAddOns: false })).toMatchObject({
        ok: true,
        data: { suggestAddOns: false },
      });
      expect(await updateProductAction({ id: validProductId, suggestAddOns: "on" })).toMatchObject({
        ok: true,
        data: { suggestAddOns: true },
      });
      expect(await updateProductAction({ id: validProductId, suggestAddOns: false })).toMatchObject(
        {
          ok: true,
          data: { suggestAddOns: false },
        },
      );
      expect(await createProductAction({ ...input, suggestAddOns: null })).toMatchObject({
        ok: false,
        fieldErrors: { suggestAddOns: expect.any(Array) },
      });
      expect(await updateProductAction({ id: validProductId, suggestAddOns: 1 })).toMatchObject({
        ok: false,
        fieldErrors: { suggestAddOns: expect.any(Array) },
      });
    });
    it("rejects unauthenticated add-on changes", async () => {
      mockRequireAuthenticatedAction.mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(
        updateProductAction({ id: validProductId, suggestAddOns: false }),
      ).rejects.toThrow("Unauthorized");
      expect(mockProductRepo.update).not.toHaveBeenCalled();
    });
    it("creates and updates allergen tags and rejects invalid tags", async () => {
      const input = {
        name: "Bread",
        categoryId: validCategoryId,
        price: 100,
        allergens: ["gluten", "milk"],
      };
      expect(await createProductAction(input)).toMatchObject({
        ok: true,
        data: { allergens: input.allergens },
      });
      expect(await updateProductAction({ id: validProductId, allergens: [] })).toMatchObject({
        ok: true,
        data: { allergens: [] },
      });
      expect(await createProductAction({ ...input, allergens: ["invalid"] })).toMatchObject({
        ok: false,
        fieldErrors: { allergens: expect.any(Array) },
      });
      expect(
        await updateProductAction({ id: validProductId, allergens: ["invalid"] }),
      ).toMatchObject({
        ok: false,
        fieldErrors: { allergens: expect.any(Array) },
      });
    });
    it("requires authentication to change allergens", async () => {
      mockRequireAuthenticatedAction.mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(createProductAction({ allergens: ["gluten"] })).rejects.toThrow("Unauthorized");
      expect(mockProductRepo.create).not.toHaveBeenCalled();
    });
    it("validates and creates product, calling revalidatePath", async () => {
      const res = await createProductAction({
        name: "Tiramisu Maison",
        categoryId: validCategoryId,
        price: "5,00",
        unitCost: "1.80",
        stock: "10",
        visible: "true",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.name).toBe("Tiramisu Maison");
        expect(res.data.price).toBe(500);
        expect(res.data.unitCost).toBe(180);
        expect(res.data.stock).toBe(10);
      }
      expect(mockProductRepo.create).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
      // Public storefront pages (list and product detail) are refreshed too.
      expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
      expect(mockUpdateTag).toHaveBeenCalledWith(`storefront-catalog-${testBusinessId}`);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
    });

    it("returns field errors on invalid input", async () => {
      const res = await createProductAction({
        name: "",
        categoryId: "invalid-uuid",
        price: -5,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.fieldErrors).toBeDefined();
        expect(res.fieldErrors?.name).toBeDefined();
      }
    });

    it("returns error if category does not exist", async () => {
      const res = await createProductAction({
        name: "Test",
        categoryId: "99999999-9999-4999-8999-999999999999",
        price: 500,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/category does not exist/i);
      }
    });
  });

  describe("updateProductAction", () => {
    it("preserves allergens and add-on preference when omitted from partial updates", async () => {
      expect(await updateProductAction({ id: validProductId, price: 200 })).toMatchObject({
        ok: true,
        data: { allergens: ["gluten"], suggestAddOns: false },
      });
    });
    it("updates product fields and calls revalidatePath", async () => {
      const res = await updateProductAction({
        id: validProductId,
        name: "Burger Gourmet Deluxe",
        price: "14,00",
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(mockProductRepo.update).toHaveBeenCalledWith(
          testBusinessId,
          validProductId,
          expect.objectContaining({ name: "Burger Gourmet Deluxe", price: 1400 }),
        );
      }
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
      expect(mockRemoveProductImage).not.toHaveBeenCalled();
    });

    it("cleans up orphaned image when imageUrl is replaced or cleared (#123, L4a)", async () => {
      const newImageUrl = `https://storage.example.com/product-images/${testBusinessId}/new-image.webp`;

      // 1. Replaced with a new image URL
      const resReplaced = await updateProductAction({ id: validProductId, imageUrl: newImageUrl });
      expect(resReplaced.ok).toBe(true);
      expect(mockRemoveProductImage).toHaveBeenCalledWith(testBusinessId, "/images/burger.jpg");

      mockRemoveProductImage.mockClear();

      // 2. Cleared with null
      const resCleared = await updateProductAction({ id: validProductId, imageUrl: null });
      expect(resCleared.ok).toBe(true);
      expect(mockRemoveProductImage).toHaveBeenCalledWith(testBusinessId, "/images/burger.jpg");

      mockRemoveProductImage.mockClear();

      // 3. Same image URL: no orphan removal
      const resUnchanged = await updateProductAction({
        id: validProductId,
        imageUrl: "/images/burger.jpg",
      });
      expect(resUnchanged.ok).toBe(true);
      expect(mockRemoveProductImage).not.toHaveBeenCalled();
    });
  });

  describe("toggleProductVisibilityAction", () => {
    it("toggles product visibility", async () => {
      const res = await toggleProductVisibilityAction({
        productId: validProductId,
        visible: false,
      });
      expect(res.ok).toBe(true);
      expect(mockProductRepo.update).toHaveBeenCalledWith(testBusinessId, validProductId, {
        visible: false,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });
  });

  describe("softDeleteProductAction", () => {
    it("soft-deletes product without hard delete and cleans up storage image (#123, L4a)", async () => {
      const res = await softDeleteProductAction(validProductId);
      expect(res.ok).toBe(true);
      expect(mockProductRepo.softDelete).toHaveBeenCalledWith(testBusinessId, validProductId);
      expect(mockRemoveProductImage).toHaveBeenCalledWith(testBusinessId, "/images/burger.jpg");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });

    it("does not call removeProductImage if product has no image", async () => {
      mockProductRepo.findById.mockResolvedValueOnce({
        ...mockProducts[0],
        imageUrl: null,
      });

      const res = await softDeleteProductAction(validProductId);
      expect(res.ok).toBe(true);
      expect(mockRemoveProductImage).not.toHaveBeenCalled();
    });

    it("rejects invalid product ID with validation error", async () => {
      const res = await softDeleteProductAction("not-a-uuid");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("VALIDATION");
      }
    });
  });

  describe("adjustProductStockAction", () => {
    it("updates stock when non-negative", async () => {
      const res = await adjustProductStockAction({
        productId: validProductId,
        stock: 25,
        reason: "Restock / Delivery",
      });
      expect(res.ok).toBe(true);
      expect(mockProductRepo.update).toHaveBeenCalledWith(testBusinessId, validProductId, {
        stock: 25,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });

    it("rejects negative stock adjustment", async () => {
      const res = await adjustProductStockAction({ productId: validProductId, stock: -5 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/cannot be negative/i);
      }
    });
  });

  describe("uploadProductImageAction", () => {
    const validJpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const validBase64 = `data:image/jpeg;base64,${validJpegBytes.toString("base64")}`;

    describe("in mock mode", () => {
      beforeEach(() => {
        vi.stubEnv("DATA_SOURCE", "mock");
      });

      it("returns imageUrl for valid base64 data URL", async () => {
        const res = await uploadProductImageAction({
          base64Data: validBase64,
        });
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.data.imageUrl).toBe(validBase64);
        }
      });

      it("rejects non-image payload", async () => {
        const res = await uploadProductImageAction({
          base64Data: "not-an-image",
        });
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.message).toMatch(/valid image/i);
        }
      });

      it("rejects disallowed MIME type", async () => {
        const res = await uploadProductImageAction({
          base64Data: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        });
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.message).toMatch(/unsupported image format/i);
        }
      });
    });

    describe("in supabase mode", () => {
      beforeEach(() => {
        vi.stubEnv("DATA_SOURCE", "supabase");
      });

      it("uploads image to storage and returns remote public URL", async () => {
        const expectedUrl = `https://storage.example.com/product-images/${testBusinessId}/img.jpg`;
        mockUploadProductImage.mockResolvedValueOnce(expectedUrl);

        const res = await uploadProductImageAction({
          base64Data: validBase64,
          fileName: "burger.jpg",
        });

        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.data.imageUrl).toBe(expectedUrl);
        }
        expect(mockUploadProductImage).toHaveBeenCalledWith(
          testBusinessId,
          expect.objectContaining({
            base64Data: validBase64,
            fileName: "burger.jpg",
          }),
        );
      });

      it("catches storage upload failures and returns error", async () => {
        mockUploadProductImage.mockRejectedValueOnce(
          new Error("Supabase Storage permission denied"),
        );

        const res = await uploadProductImageAction({
          base64Data: validBase64,
        });

        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(res.code).toBe("INTERNAL");
          expect(res.message).not.toContain("permission denied");
        }
      });

      it("rejects invalid image payload before storage upload", async () => {
        const res = await uploadProductImageAction({
          base64Data: "not-a-valid-data-url",
        });

        expect(res.ok).toBe(false);
        expect(mockUploadProductImage).not.toHaveBeenCalled();
      });
    });
  });
});
