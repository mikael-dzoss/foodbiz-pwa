import type { Repositories } from "@/domain/repositories";
import { describe, expect, it } from "vitest";

export function describeExpenseRepositoryContract(
  getRepositories: () => Promise<Repositories> | Repositories,
  businessId: string,
): void {
  describe("ExpenseRepository contract", () => {
    it("list returns expenses with tag and date range filters", async () => {
      const repos = await getRepositories();
      const all = await repos.expenses.list(businessId);
      expect(all.length).toBeGreaterThan(0);

      const ingredientExpenses = await repos.expenses.list(businessId, { tag: "Ingredients" });
      expect(ingredientExpenses.length).toBeGreaterThan(0);
      expect(ingredientExpenses.every((e) => e.tags.includes("Ingredients"))).toBe(true);

      const dateFiltered = await repos.expenses.list(businessId, {
        fromDate: "2026-09-01",
        toDate: "2026-09-30",
      });
      expect(dateFiltered.every((e) => e.date >= "2026-09-01" && e.date <= "2026-09-30")).toBe(
        true,
      );
    });

    it("findById returns expense or null", async () => {
      const repos = await getRepositories();
      const first = (await repos.expenses.list(businessId))[0];
      const found = await repos.expenses.findById(businessId, first.id);
      expect(found).not.toBeNull();
      expect(found?.description).toBe(first.description);

      const notFound = await repos.expenses.findById(
        businessId,
        "00000000-0000-4000-8000-000000000099",
      );
      expect(notFound).toBeNull();
    });

    it("create adds an expense with tags", async () => {
      const repos = await getRepositories();
      const created = await repos.expenses.create(businessId, {
        amount: 5400,
        date: "2026-10-09",
        description: "Yeast 10kg bulk purchase",
        tags: ["Ingredients"],
      });

      expect(created.id).toBeDefined();
      expect(created.amount).toBe(5400);
      expect(created.tags).toContain("Ingredients");

      const found = await repos.expenses.findById(businessId, created.id);
      expect(found?.description).toBe("Yeast 10kg bulk purchase");
    });

    it("update modifies expense and delete removes it", async () => {
      const repos = await getRepositories();
      const created = await repos.expenses.create(businessId, {
        amount: 2500,
        date: "2026-10-09",
        description: "Packaging tape",
      });

      const updated = await repos.expenses.update(businessId, created.id, {
        amount: 2800,
      });
      expect(updated.amount).toBe(2800);

      await repos.expenses.delete(businessId, created.id);
      const found = await repos.expenses.findById(businessId, created.id);
      expect(found).toBeNull();

      await expect(repos.expenses.delete(businessId, created.id)).rejects.toThrow();
    });
  });
}
