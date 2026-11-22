import { describe, it, expect } from "vitest";
import {
  productSchema,
  createProductSchema,
  updateProductSchema,
  productFormInputSchema,
  adjustStockSchema,
  toggleProductVisibilitySchema,
  parseEuroStringToCents,
  centsToEuroString,
  calculateGrossMargin,
  normalizeSearchText,
  searchMenuProducts,
  type SearchableCategoryGroup,
} from "../product";

describe("Product Domain & Schemas", () => {
  const validCategoryId = "11111111-1111-4111-8111-111111111101";
  const validProductId = "22222222-2222-4222-8222-222222222201";

  it("defaults allergens and rejects unsupported allergen tags across product schemas", () => {
    const input = {
      id: validProductId,
      businessId: validCategoryId,
      categoryId: validCategoryId,
      name: "Bread",
      price: 100,
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z",
    };
    for (const schema of [
      productSchema,
      createProductSchema,
      updateProductSchema,
      productFormInputSchema,
    ]) {
      expect(schema.parse(input).allergens).toEqual([]);
      expect(schema.parse({ ...input, allergens: ["gluten", "milk"] }).allergens).toEqual([
        "gluten",
        "milk",
      ]);
      expect(schema.safeParse({ ...input, allergens: ["unknown"] }).success).toBe(false);
      expect(schema.safeParse({ ...input, allergens: "gluten" }).success).toBe(false);
    }
  });

  it("defaults suggestAddOns to true across product schemas", () => {
    const input = {
      id: validProductId,
      businessId: validCategoryId,
      categoryId: validCategoryId,
      name: "Bread",
      price: 100,
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z",
    };
    for (const schema of [
      productSchema,
      createProductSchema,
      updateProductSchema,
      productFormInputSchema,
    ]) {
      expect(schema.parse(input).suggestAddOns).toBe(true);
      expect(schema.parse({ ...input, suggestAddOns: false }).suggestAddOns).toBe(false);
    }
    for (const value of [true, "true", "on"])
      expect(productFormInputSchema.parse({ ...input, suggestAddOns: value }).suggestAddOns).toBe(
        true,
      );
    for (const value of [false, "false", ""])
      expect(productFormInputSchema.parse({ ...input, suggestAddOns: value }).suggestAddOns).toBe(
        false,
      );
    expect(productFormInputSchema.safeParse({ ...input, suggestAddOns: 1 }).success).toBe(false);
  });

  describe("parseEuroStringToCents & centsToEuroString", () => {
    it("parses euro decimal string to integer cents", () => {
      expect(parseEuroStringToCents("12.50")).toBe(1250);
      expect(parseEuroStringToCents("12,50")).toBe(1250);
      expect(parseEuroStringToCents("12,50 €")).toBe(1250);
      expect(parseEuroStringToCents("0")).toBe(0);
      expect(parseEuroStringToCents("0.50")).toBe(50);
      expect(parseEuroStringToCents("5")).toBe(500);
    });

    it("returns NaN for invalid input strings", () => {
      expect(parseEuroStringToCents("abc")).toBeNaN();
      expect(parseEuroStringToCents("")).toBeNaN();
    });

    it("converts cents to decimal euro string", () => {
      expect(centsToEuroString(1250)).toBe("12.50");
      expect(centsToEuroString(0)).toBe("0.00");
      expect(centsToEuroString(50)).toBe("0.50");
      expect(centsToEuroString(500)).toBe("5.00");
    });
  });

  describe("calculateGrossMargin", () => {
    it("calculates gross margin percentage accurately", () => {
      // 12.50 price (1250 cents), 4.20 unit cost (420 cents) -> (830 / 1250) * 100 = 66.4%
      expect(calculateGrossMargin(1250, 420)).toBe(66.4);
      // 0 cost -> 100%
      expect(calculateGrossMargin(1000, 0)).toBe(100);
      // 0 price -> 0%
      expect(calculateGrossMargin(0, 500)).toBe(0);
      // cost equals price -> 0%
      expect(calculateGrossMargin(500, 500)).toBe(0);
    });
  });

  describe("createProductSchema", () => {
    it("validates valid product input with cents", () => {
      const res = createProductSchema.safeParse({
        name: "Burger Gourmet",
        categoryId: validCategoryId,
        description: "Juicy handcrafted beef burger",
        price: 1250,
        unitCost: 420,
        stock: 18,
        visible: true,
        imageUrl: "/images/burger.jpg",
      });
      expect(res.success).toBe(true);
    });

    it("rejects empty name or invalid price/stock", () => {
      expect(
        createProductSchema.safeParse({
          name: "",
          categoryId: validCategoryId,
          price: 1250,
        }).success,
      ).toBe(false);

      expect(
        createProductSchema.safeParse({
          name: "Burger",
          categoryId: validCategoryId,
          price: -10,
        }).success,
      ).toBe(false);

      expect(
        createProductSchema.safeParse({
          name: "Burger",
          categoryId: validCategoryId,
          price: 1250,
          stock: -1,
        }).success,
      ).toBe(false);
    });
  });

  describe("updateProductSchema", () => {
    it("validates partial update input with id", () => {
      const res = updateProductSchema.safeParse({
        id: validProductId,
        name: "Burger Gourmet Deluxe",
        price: 1400,
      });
      expect(res.success).toBe(true);
    });
  });

  describe("productFormInputSchema", () => {
    it("parses and transforms decimal euro strings to cents", () => {
      const res = productFormInputSchema.safeParse({
        name: "Burger Gourmet",
        categoryId: validCategoryId,
        price: "12,50",
        unitCost: "4.20",
        stock: "18",
        visible: "on",
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.price).toBe(1250);
        expect(res.data.unitCost).toBe(420);
        expect(res.data.stock).toBe(18);
        expect(res.data.visible).toBe(true);
      }
    });

    it("accepts direct integer cents if already transformed", () => {
      const res = productFormInputSchema.safeParse({
        name: "Salade César",
        categoryId: validCategoryId,
        price: 900,
        unitCost: 250,
        stock: 0,
        visible: true,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.price).toBe(900);
        expect(res.data.unitCost).toBe(250);
        expect(res.data.stock).toBe(0);
        expect(res.data.visible).toBe(true);
      }
    });
  });

  describe("adjustStockSchema", () => {
    it("validates positive stock count", () => {
      const res = adjustStockSchema.safeParse({
        productId: validProductId,
        stock: 20,
        reason: "Restock / Delivery",
      });
      expect(res.success).toBe(true);
    });

    it("rejects negative stock count", () => {
      const res = adjustStockSchema.safeParse({
        productId: validProductId,
        stock: -1,
      });
      expect(res.success).toBe(false);
    });
  });

  describe("toggleProductVisibilitySchema", () => {
    it("validates visibility toggle", () => {
      const res = toggleProductVisibilitySchema.safeParse({
        productId: validProductId,
        visible: false,
      });
      expect(res.success).toBe(true);
    });
  });

  describe("normalizeSearchText & searchMenuProducts (#203)", () => {
    const sampleGroups: SearchableCategoryGroup<{
      id: string;
      name: string;
      description: string | null;
    }>[] = [
      {
        id: "cat-1",
        name: "Pâtisserie Fine",
        products: [
          {
            id: "p-1",
            name: "Éclair au Café",
            description: "Choux pastry filled with crème pâtissière",
          },
          {
            id: "p-2",
            name: "Tarte au Citron",
            description: "Tangy lemon curd tartlet",
          },
        ],
      },
      {
        id: "cat-2",
        name: "Grillades",
        products: [
          {
            id: "p-3",
            name: "Poulet Braisé",
            description: null,
          },
        ],
      },
    ];

    it("normalizes case, accents, and ligatures", () => {
      expect(normalizeSearchText("  Éclair Crème Cœur  ")).toBe("eclair creme coeur");
    });

    it("returns empty array when query is empty or whitespace", () => {
      expect(searchMenuProducts(sampleGroups, "")).toEqual([]);
      expect(searchMenuProducts(sampleGroups, "   ")).toEqual([]);
    });

    it("matches case- and diacritics-insensitively on product name, description, and category name", () => {
      // Match product name without accents
      const byName = searchMenuProducts(sampleGroups, "eclair");
      expect(byName.map((r) => r.product.id)).toEqual(["p-1"]);
      expect(byName[0]?.categoryName).toBe("Pâtisserie Fine");

      // Match product description without accents
      const byDesc = searchMenuProducts(sampleGroups, "CREME");
      expect(byDesc.map((r) => r.product.id)).toEqual(["p-1"]);

      // Match category name without accents
      const byCategory = searchMenuProducts(sampleGroups, "patisserie");
      expect(byCategory.map((r) => r.product.id)).toEqual(["p-1", "p-2"]);

      // Non-matching query
      expect(searchMenuProducts(sampleGroups, "pizza")).toEqual([]);
    });
  });
});
