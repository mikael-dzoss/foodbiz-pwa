import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export function describeProductRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("ProductRepository contract", () => {
    it("findById returns product for matching businessId and id", async () => {
      const repos = await getRepositories();
      const existing = (await repos.products.list(businessId))[0];
      expect(existing).toBeDefined();

      const found = await repos.products.findById(businessId, existing.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(existing.id);
      expect(found?.name).toBe(existing.name);
    });

    it("findById returns null when product does not exist or wrong businessId", async () => {
      const repos = await getRepositories();
      const nonExistent = await repos.products.findById(
        businessId,
        "00000000-0000-4000-8000-000000000099",
      );
      expect(nonExistent).toBeNull();

      const existing = (await repos.products.list(businessId))[0];
      const wrongBusiness = await repos.products.findById(
        "99999999-9999-4999-8999-999999999999",
        existing.id,
      );
      expect(wrongBusiness).toBeNull();
    });

    it("list returns products with optional categoryId and visibleOnly filters", async () => {
      const repos = await getRepositories();
      const all = await repos.products.list(businessId);
      expect(all.length).toBeGreaterThan(0);

      const targetCategoryId = all[0].categoryId;
      const inCategory = await repos.products.list(businessId, {
        categoryId: targetCategoryId,
      });
      expect(inCategory.length).toBeGreaterThan(0);
      expect(inCategory.every((p) => p.categoryId === targetCategoryId)).toBe(true);

      const visibleOnly = await repos.products.list(businessId, { visibleOnly: true });
      expect(visibleOnly.every((p) => p.visible === true)).toBe(true);
    });

    it("create persists a new product with default values and timestamps", async () => {
      const repos = await getRepositories();
      const category = (await repos.categories.list(businessId))[0];
      const created = await repos.products.create(businessId, {
        categoryId: category.id,
        name: "Artisan Brioche Loaf",
        price: 520,
        unitCost: 150,
        stock: 10,
      });

      expect(created.id).toBeDefined();
      expect(created.businessId).toBe(businessId);
      expect(created.name).toBe("Artisan Brioche Loaf");
      expect(created.price).toBe(520);
      expect(created.visible).toBe(true);
      expect(created.createdAt).toBeDefined();

      const found = await repos.products.findById(businessId, created.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Artisan Brioche Loaf");
    });

    it("update modifies fields and updates updatedAt", async () => {
      const repos = await getRepositories();
      const existing = (await repos.products.list(businessId))[0];

      const updated = await repos.products.update(businessId, existing.id, {
        price: 999,
        stock: 50,
      });

      expect(updated.id).toBe(existing.id);
      expect(updated.price).toBe(999);
      expect(updated.stock).toBe(50);

      const fetched = await repos.products.findById(businessId, existing.id);
      expect(fetched?.price).toBe(999);
    });

    it("update throws when product does not exist", async () => {
      const repos = await getRepositories();
      await expect(
        repos.products.update(businessId, "00000000-0000-4000-8000-000000000099", {
          price: 500,
        }),
      ).rejects.toThrow();
    });

    it("softDelete sets visible to false", async () => {
      const repos = await getRepositories();
      const existing = (await repos.products.list(businessId, { visibleOnly: true }))[0];

      const archived = await repos.products.softDelete(businessId, existing.id);
      expect(archived.visible).toBe(false);

      const found = await repos.products.findById(businessId, existing.id);
      expect(found?.visible).toBe(false);

      const visibleList = await repos.products.list(businessId, { visibleOnly: true });
      expect(visibleList.some((p) => p.id === existing.id)).toBe(false);
    });
  });
}
