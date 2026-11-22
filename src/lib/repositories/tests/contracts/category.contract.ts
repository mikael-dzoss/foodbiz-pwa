import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export function describeCategoryRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("CategoryRepository contract", () => {
    it("list returns categories sorted by sortOrder", async () => {
      const repos = await getRepositories();
      const list = await repos.categories.list(businessId);
      expect(list.length).toBeGreaterThan(0);
      for (let i = 1; i < list.length; i++) {
        expect(list[i].sortOrder).toBeGreaterThanOrEqual(list[i - 1].sortOrder);
      }
    });

    it("findById returns category or null", async () => {
      const repos = await getRepositories();
      const first = (await repos.categories.list(businessId))[0];
      const found = await repos.categories.findById(businessId, first.id);
      expect(found).not.toBeNull();
      expect(found?.name).toBe(first.name);

      const notFound = await repos.categories.findById(
        businessId,
        "00000000-0000-4000-8000-000000000099",
      );
      expect(notFound).toBeNull();
    });

    it("create adds a category", async () => {
      const repos = await getRepositories();
      const created = await repos.categories.create(businessId, {
        name: "Seasonal Specials",
        sortOrder: 10,
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("Seasonal Specials");
      expect(created.sortOrder).toBe(10);
      expect(created.role).toBe("regular");

      const found = await repos.categories.findById(businessId, created.id);
      expect(found?.name).toBe("Seasonal Specials");
    });

    it("update modifies category properties", async () => {
      const repos = await getRepositories();
      const created = await repos.categories.create(businessId, {
        name: "Temp Cat",
        role: "drinks",
        sortOrder: 50,
      });

      const updated = await repos.categories.update(businessId, created.id, {
        name: "Renamed Cat",
        role: "snacks",
        sortOrder: 55,
      });

      expect(updated.name).toBe("Renamed Cat");
      expect(updated.sortOrder).toBe(55);
      expect(created.role).toBe("drinks");
      expect((await repos.categories.findById(businessId, created.id))?.role).toBe("snacks");
    });

    it("delete removes category and throws on non-existent", async () => {
      const repos = await getRepositories();
      const created = await repos.categories.create(businessId, {
        name: "To Delete",
      });

      await repos.categories.delete(businessId, created.id);
      const found = await repos.categories.findById(businessId, created.id);
      expect(found).toBeNull();

      await expect(repos.categories.delete(businessId, created.id)).rejects.toThrow();
    });
  });
}
