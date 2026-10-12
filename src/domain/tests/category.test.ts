import { describe, expect, it } from "vitest";
import { createCategorySchema, renameCategorySchema, deleteCategorySchema } from "../category";

describe("domain: category schemas", () => {
  it("validates create category input", () => {
    const valid = { name: "Desserts", sortOrder: 1 };
    expect(createCategorySchema.safeParse(valid).success).toBe(true);

    const trimmed = createCategorySchema.parse({ name: "  Breads  " });
    expect(trimmed.name).toBe("Breads");
  });

  it("rejects empty category name on create", () => {
    const invalid = { name: "   " };
    const res = createCategorySchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("validates rename category input", () => {
    const valid = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Pastries & Cakes",
    };
    expect(renameCategorySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid uuid on rename", () => {
    const invalid = {
      id: "invalid-uuid",
      name: "Pastries",
    };
    expect(renameCategorySchema.safeParse(invalid).success).toBe(false);
  });

  it("validates delete category input", () => {
    const valid = { id: "11111111-1111-4111-8111-111111111111" };
    expect(deleteCategorySchema.safeParse(valid).success).toBe(true);
  });
});
