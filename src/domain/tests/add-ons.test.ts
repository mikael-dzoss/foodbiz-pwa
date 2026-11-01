import { describe, expect, it } from "vitest";
import { getAddOnCandidates } from "../add-ons";
import type { Product, ProductCategory } from "../product";
import { demoCategories, demoProducts } from "@/lib/repositories/mock/fixtures";

const baseProduct = demoProducts[0]; // Traditional Baguette (breads, regular)

function makeCategory(id: string, patch: Partial<ProductCategory> = {}): ProductCategory {
  return {
    ...demoCategories[0],
    id,
    ...patch,
  };
}

function makeProduct(id: string, patch: Partial<Product> = {}): Product {
  return {
    ...baseProduct,
    id,
    ...patch,
  };
}

describe("getAddOnCandidates (#206)", () => {
  it("returns visible in-stock drinks sorted by category sortOrder then name for a regular product", () => {
    const categories: ProductCategory[] = [
      makeCategory("cat-regular", { role: "regular", sortOrder: 1 }),
      makeCategory("cat-drinks-late", { role: "drinks", sortOrder: 3 }),
      makeCategory("cat-drinks-early", { role: "drinks", sortOrder: 2 }),
      makeCategory("cat-snacks", { role: "snacks", sortOrder: 4 }),
    ];
    const dish = makeProduct("dish-1", {
      categoryId: "cat-regular",
      suggestAddOns: true,
    });
    const products: Product[] = [
      dish,
      makeProduct("drink-late-a", {
        categoryId: "cat-drinks-late",
        name: "Apple Cider",
        stock: 5,
        visible: true,
      }),
      makeProduct("drink-early-z", {
        categoryId: "cat-drinks-early",
        name: "Zesty Lemonade",
        stock: 5,
        visible: true,
      }),
      makeProduct("drink-early-a", {
        categoryId: "cat-drinks-early",
        name: "Americano",
        stock: 5,
        visible: true,
      }),
      makeProduct("snack-1", {
        categoryId: "cat-snacks",
        name: "Cookie",
        stock: 5,
        visible: true,
      }),
    ];

    const originalCategories = structuredClone(categories);
    const originalProducts = structuredClone(products);

    const result = getAddOnCandidates(dish, categories, products);

    expect(result).toEqual({
      kind: "drinks",
      products: [products[3], products[2], products[1]],
    });
    expect(categories).toEqual(originalCategories);
    expect(products).toEqual(originalProducts);
  });

  it("excludes hidden, out-of-stock, and self products from drink candidates", () => {
    const categories: ProductCategory[] = [
      makeCategory("cat-regular", { role: "regular", sortOrder: 1 }),
      makeCategory("cat-drinks", { role: "drinks", sortOrder: 2 }),
    ];
    const dish = makeProduct("dish-1", {
      categoryId: "cat-regular",
      suggestAddOns: true,
    });
    const validDrink = makeProduct("drink-valid", {
      categoryId: "cat-drinks",
      name: "Espresso",
      stock: 3,
      visible: true,
    });
    const products: Product[] = [
      validDrink,
      makeProduct("drink-hidden", {
        categoryId: "cat-drinks",
        name: "Hidden Tea",
        stock: 10,
        visible: false,
      }),
      makeProduct("drink-empty", {
        categoryId: "cat-drinks",
        name: "Sold Out Juice",
        stock: 0,
        visible: true,
      }),
      makeProduct("dish-1", {
        categoryId: "cat-drinks",
        name: "Duplicate Self ID",
        stock: 10,
        visible: true,
      }),
    ];

    expect(getAddOnCandidates(dish, categories, products)).toEqual({
      kind: "drinks",
      products: [validDrink],
    });
  });

  it("returns null when suggestAddOns is false", () => {
    const dish = { ...demoProducts[0], suggestAddOns: false };
    expect(getAddOnCandidates(dish, demoCategories, demoProducts)).toBeNull();
  });

  it("returns null for products in drinks or snacks categories", () => {
    const drinkProduct = demoProducts.find(
      (p) => p.categoryId === "22222222-2222-4222-8222-222222222203",
    )!;
    const snackProduct = demoProducts.find(
      (p) => p.categoryId === "22222222-2222-4222-8222-222222222204",
    )!;

    expect(getAddOnCandidates(drinkProduct, demoCategories, demoProducts)).toBeNull();
    expect(getAddOnCandidates(snackProduct, demoCategories, demoProducts)).toBeNull();
  });

  it("returns null when no eligible drink candidates are available", () => {
    const dish = demoProducts[0];
    const noDrinks = demoProducts.filter(
      (p) => p.categoryId !== "22222222-2222-4222-8222-222222222203",
    );
    expect(getAddOnCandidates(dish, demoCategories, noDrinks)).toBeNull();
  });

  it("treats a product with an unmapped categoryId as regular and suggests drinks", () => {
    const uncategorizedDish = makeProduct("dish-uncat", {
      categoryId: "99999999-9999-4999-8999-999999999999",
      suggestAddOns: true,
    });
    const result = getAddOnCandidates(uncategorizedDish, demoCategories, demoProducts);
    expect(result?.kind).toBe("drinks");
    expect(result?.products.length).toBeGreaterThan(0);
  });
});
