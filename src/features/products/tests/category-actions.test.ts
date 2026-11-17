import { requireAuthenticatedAction } from "@/features/auth";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/domain/repositories/types";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { listCategories } from "../category-data";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
} from "../category-actions";

const mockRevalidatePath = vi.fn();
const mockUpdateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) =>
    type ? mockRevalidatePath(path, type) : mockRevalidatePath(path),
  updateTag: (tag: string) => mockUpdateTag(tag),
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
  create: vi.fn(async (_bId: string, input: CreateCategoryInput) => ({
    id: "22222222-2222-4222-8222-222222222299",
    businessId: "11111111-1111-4111-8111-111111111111",
    name: input.name,
    sortOrder: input.sortOrder ?? 3,
    role: input.role ?? "regular",
    createdAt: new Date().toISOString(),
  })),
  update: vi.fn(async (_bId: string, id: string, input: UpdateCategoryInput) => ({
    id,
    businessId: "11111111-1111-4111-8111-111111111111",
    name: input.name ?? "Updated",
    role: input.role ?? "regular",
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

  describe("listCategories (data module)", () => {
    it("returns list of categories", async () => {
      const res = await listCategories();
      expect(res).toHaveLength(2);
      expect(res[0].name).toBe("Breads");
    });

    it("returns list of categories with computed product counts", async () => {
      mockProductRepo.list.mockResolvedValueOnce([
        { id: "p1", categoryId: "22222222-2222-4222-8222-222222222201" },
        { id: "p2", categoryId: "22222222-2222-4222-8222-222222222201" },
      ] as unknown as import("@/domain/product").Product[]);

      const res = await listCategories();
      expect(res[0].productCount).toBe(2);
      expect(res[1].productCount).toBe(0);
    });

    it("throws on repository failure instead of returning an empty list", async () => {
      mockCategoryRepo.list.mockRejectedValueOnce(new Error("Offline"));
      await expect(listCategories()).rejects.toThrow("Offline");
    });
  });

  describe("createCategoryAction", () => {
    it("creates and edits category roles with validation", async () => {
      expect(await createCategoryAction({ name: "Coffee", role: "drinks" })).toMatchObject({
        ok: true,
        data: { role: "drinks" },
      });
      expect(
        await renameCategoryAction({ id: mockCategories[0].id, name: "Breads", role: "snacks" }),
      ).toMatchObject({ ok: true, data: { role: "snacks" } });
      expect(await createCategoryAction({ name: "Coffee", role: "invalid" })).toMatchObject({
        ok: false,
      });
      expect(
        await renameCategoryAction({ id: mockCategories[0].id, name: "Breads", role: "invalid" }),
      ).toMatchObject({ ok: false });
    });
    it("requires authentication before changing roles", async () => {
      vi.mocked(requireAuthenticatedAction).mockRejectedValueOnce(new Error("Unauthorized"));
      await expect(createCategoryAction({ name: "Coffee", role: "drinks" })).rejects.toThrow(
        "Unauthorized",
      );
      expect(mockCategoryRepo.create).not.toHaveBeenCalled();
    });
    it("creates a new category when name is valid and unique", async () => {
      const res = await createCategoryAction({ name: "Sandwiches" });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.name).toBe("Sandwiches");
        expect(mockCategoryRepo.create).toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/categories");
        expect(mockUpdateTag).toHaveBeenCalledWith("storefront-catalog");
        expect(mockRevalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
      }
    });

    it("rejects duplicate category name (case-insensitive)", async () => {
      const res = await createCategoryAction({ name: "breads" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/already exists/i);
      }
      expect(mockCategoryRepo.create).not.toHaveBeenCalled();
    });

    it("rejects invalid input", async () => {
      const res = await createCategoryAction({ name: "" });
      expect(res.ok).toBe(false);
      expect(mockCategoryRepo.create).not.toHaveBeenCalled();
    });
  });

  describe("renameCategoryAction", () => {
    it("renames category when valid and unique", async () => {
      const res = await renameCategoryAction({
        id: "22222222-2222-4222-8222-222222222201",
        name: "Artisan Breads",
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
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
      expect(res.ok).toBe(true);
    });

    it("rejects renaming to an existing name of another category", async () => {
      const res = await renameCategoryAction({
        id: "22222222-2222-4222-8222-222222222201",
        name: "Pastries",
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/already exists/i);
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
      expect(res.ok).toBe(true);
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
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toMatch(/cannot delete.*product.*assigned/i);
      }
      expect(mockCategoryRepo.delete).not.toHaveBeenCalled();
    });

    it("rejects invalid input schema", async () => {
      const res = await deleteCategoryAction({ id: "invalid-id" });
      expect(res.ok).toBe(false);
      expect(mockCategoryRepo.delete).not.toHaveBeenCalled();
    });
  });
});
