import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listCategoriesAction,
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
} from "../category-actions";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

const mockCategories = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    businessId: "11111111-1111-4111-8111-111111111111",
    name: "Breads",
    sortOrder: 1,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    businessId: "11111111-1111-4111-8111-111111111111",
    name: "Pastries",
    sortOrder: 2,
    createdAt: "2026-08-01T08:00:00.000Z",
  },
];

const mockCategoryRepo = {
  list: vi.fn(async () => [...mockCategories]),
  findById: vi.fn(
    async (_bId: string, id: string) => mockCategories.find((c) => c.id === id) ?? null,
  ),
  create: vi.fn(async (_bId: string, input: { name: string; sortOrder?: number }) => ({
    id: "22222222-2222-4222-8222-222222222299",
    businessId: "11111111-1111-4111-8111-111111111111",
    name: input.name,
    sortOrder: input.sortOrder ?? 3,
    createdAt: new Date().toISOString(),
  })),
  update: vi.fn(async (_bId: string, id: string, input: { name?: string }) => ({
    id,
    businessId: "11111111-1111-4111-8111-111111111111",
    name: input.name ?? "Updated",
    sortOrder: 1,
    createdAt: "2026-08-01T08:00:00.000Z",
  })),
  delete: vi.fn(async () => undefined),
};

const mockProductRepo = {
  list: vi.fn<() => Promise<import("@/domain/product").Product[]>>(async () => []),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    categories: mockCategoryRepo,
    products: mockProductRepo,
  }),
}));

vi.mock("@/features/auth", () => ({
  requireAuthenticatedAction: vi.fn(async () => ({
    session: {
      user: {
        id: "00000000-0000-4000-8000-000000000002",
        role: "manager",
        email: "manager@test.com",
        name: "Manager",
        businessId: "11111111-1111-4111-8111-111111111111",
      },
      business: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Test Bakery",
        slug: "test-bakery",
        currency: "EUR",
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    businessId: "11111111-1111-4111-8111-111111111111",
  })),
}));

describe("features: category actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCategoriesAction", () => {
    it("returns list of categories", async () => {
      const res = await listCategoriesAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toHaveLength(2);
        expect(res.data[0].name).toBe("Breads");
      }
    });

    it("returns list of categories with computed product counts", async () => {
      mockProductRepo.list.mockResolvedValueOnce([
        { id: "p1", categoryId: "22222222-2222-4222-8222-222222222201" },
        { id: "p2", categoryId: "22222222-2222-4222-8222-222222222201" },
      ] as unknown as import("@/domain/product").Product[]);

      const res = await listCategoriesAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data[0].productCount).toBe(2);
        expect(res.data[1].productCount).toBe(0);
      }
    });
  });

  describe("createCategoryAction", () => {
    it("creates a new category when name is valid and unique", async () => {
      const res = await createCategoryAction({ name: "Sandwiches" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Sandwiches");
        expect(mockCategoryRepo.create).toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/categories");
      }
    });

    it("rejects duplicate category name (case-insensitive)", async () => {
      const res = await createCategoryAction({ name: "breads" });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/already exists/i);
      }
      expect(mockCategoryRepo.create).not.toHaveBeenCalled();
    });

    it("rejects invalid input", async () => {
      const res = await createCategoryAction({ name: "" });
      expect(res.success).toBe(false);
      expect(mockCategoryRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("renameCategoryAction", () => {
    it("renames category when valid and unique", async () => {
      const res = await renameCategoryAction({
        id: "22222222-2222-4222-8222-222222222201",
        name: "Artisan Breads",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.name).toBe("Artisan Breads");
        expect(mockCategoryRepo.update).toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/categories");
      }
    });

    it("allows keeping the same name for itself", async () => {
      const res = await renameCategoryAction({
        id: "22222222-2222-4222-8222-222222222201",
        name: "Breads",
      });
      expect(res.success).toBe(true);
    });

    it("rejects renaming to an existing name of another category", async () => {
      const res = await renameCategoryAction({
        id: "22222222-2222-4222-8222-222222222201",
        name: "Pastries",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/already exists/i);
      }
      expect(mockCategoryRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteCategoryAction", () => {
    it("deletes empty category successfully", async () => {
      mockProductRepo.list.mockResolvedValueOnce([]);

      const res = await deleteCategoryAction({
        id: "22222222-2222-4222-8222-222222222201",
      });
      expect(res.success).toBe(true);
      expect(mockCategoryRepo.delete).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222201",
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/categories");
    });

    it("rejects deletion when category has products, explaining reason", async () => {
      mockProductRepo.list.mockResolvedValueOnce([{ id: "p1", name: "Croissant" } as never]);

      const res = await deleteCategoryAction({
        id: "22222222-2222-4222-8222-222222222202",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/cannot delete.*product.*assigned/i);
      }
      expect(mockCategoryRepo.delete).not.toHaveBeenCalled();
    });

    it("rejects invalid input schema", async () => {
      const res = await deleteCategoryAction({ id: "invalid-id" });
      expect(res.success).toBe(false);
      expect(mockCategoryRepo.delete).not.toHaveBeenCalled();
    });
  });
});
