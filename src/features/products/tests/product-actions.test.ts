import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CreateProductInput, UpdateProductInput } from "@/domain";
import {
  listProductsAction,
  getProductAction,
  createProductAction,
  updateProductAction,
  toggleProductVisibilityAction,
  softDeleteProductAction,
  adjustProductStockAction,
  uploadProductImageAction,
} from "../product-actions";

const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
  revalidateTag: (tag: string, profile?: string) => mockRevalidateTag(tag, profile),
}));

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const validCategoryId = "22222222-2222-4222-8222-222222222201";
const validProductId = "33333333-3333-4333-8333-333333333301";

const mockProducts = [
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

  describe("listProductsAction", () => {
    it("returns enriched products with category names and low stock threshold", async () => {
      const res = await listProductsAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.products).toHaveLength(1);
        expect(res.data.products[0].name).toBe("Burger Gourmet");
        expect(res.data.products[0].categoryName).toBe("Plats");
        expect(res.data.lowStockThreshold).toBe(5);
        expect(res.data.categories).toHaveLength(1);
      }
    });
  });

  describe("getProductAction", () => {
    it("returns product with category name when found", async () => {
      const res = await getProductAction(validProductId);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Burger Gourmet");
        expect(res.data.categoryName).toBe("Plats");
      }
    });

    it("returns error when product is not found", async () => {
      const res = await getProductAction("00000000-0000-0000-0000-000000000000");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/not found/i);
      }
    });
  });

  describe("createProductAction", () => {
    it("creates and updates allergen tags and rejects invalid tags", async () => {
      const input = {
        name: "Bread",
        categoryId: validCategoryId,
        price: 100,
        allergens: ["gluten", "milk"],
      };
      expect(await createProductAction(input)).toMatchObject({
        success: true,
        data: { allergens: input.allergens },
      });
      expect(await updateProductAction(validProductId, { allergens: [] })).toMatchObject({
        success: true,
        data: { allergens: [] },
      });
      expect(await createProductAction({ ...input, allergens: ["invalid"] })).toMatchObject({
        success: false,
        fieldErrors: { allergens: expect.any(Array) },
      });
      expect(await updateProductAction(validProductId, { allergens: ["invalid"] })).toMatchObject({
        success: false,
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

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Tiramisu Maison");
        expect(res.data.price).toBe(500);
        expect(res.data.unitCost).toBe(180);
        expect(res.data.stock).toBe(10);
      }
      expect(mockProductRepo.create).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });

    it("returns field errors on invalid input", async () => {
      const res = await createProductAction({
        name: "",
        categoryId: "invalid-uuid",
        price: -5,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
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

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/category does not exist/i);
      }
    });
  });

  describe("updateProductAction", () => {
    it("updates product fields and calls revalidatePath", async () => {
      const res = await updateProductAction(validProductId, {
        name: "Burger Gourmet Deluxe",
        price: "14,00",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(mockProductRepo.update).toHaveBeenCalledWith(
          testBusinessId,
          validProductId,
          expect.objectContaining({ name: "Burger Gourmet Deluxe", price: 1400 }),
        );
      }
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });
  });

  describe("toggleProductVisibilityAction", () => {
    it("toggles product visibility", async () => {
      const res = await toggleProductVisibilityAction(validProductId, false);
      expect(res.success).toBe(true);
      expect(mockProductRepo.update).toHaveBeenCalledWith(testBusinessId, validProductId, {
        visible: false,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });
  });

  describe("softDeleteProductAction", () => {
    it("soft-deletes product without hard delete", async () => {
      const res = await softDeleteProductAction(validProductId);
      expect(res.success).toBe(true);
      expect(mockProductRepo.softDelete).toHaveBeenCalledWith(testBusinessId, validProductId);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });
  });

  describe("adjustProductStockAction", () => {
    it("updates stock when non-negative", async () => {
      const res = await adjustProductStockAction(validProductId, 25, "Restock / Delivery");
      expect(res.success).toBe(true);
      expect(mockProductRepo.update).toHaveBeenCalledWith(testBusinessId, validProductId, {
        stock: 25,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/products");
    });

    it("rejects negative stock adjustment", async () => {
      const res = await adjustProductStockAction(validProductId, -5);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/cannot be negative/i);
      }
    });
  });

  describe("uploadProductImageAction", () => {
    it("returns imageUrl for valid base64 data URL", async () => {
      const res = await uploadProductImageAction({
        base64Data: "data:image/jpeg;base64,sampleimagepayload",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.imageUrl).toBe("data:image/jpeg;base64,sampleimagepayload");
      }
    });

    it("rejects non-image payload", async () => {
      const res = await uploadProductImageAction({
        base64Data: "not-an-image",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/valid image/i);
      }
    });
  });
});
