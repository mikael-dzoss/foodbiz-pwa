import { describe, expect, it } from "vitest";
import { MAX_QUANTITY_PER_LINE } from "../anti-abuse";
import type { Product } from "../product";
import { storefrontProductSchema, toStorefrontProduct } from "../storefront-product";

const product: Product = {
  id: "33333333-3333-4333-8333-333333333301",
  businessId: "11111111-1111-4111-8111-111111111111",
  categoryId: "22222222-2222-4222-8222-222222222201",
  name: "Poulet Braisé",
  description: "Grilled over embers",
  price: 130,
  unitCost: 45,
  stock: 12,
  visible: true,
  suggestAddOns: true,
  allergens: ["gluten"],
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("toStorefrontProduct", () => {
  it("keeps only the fields the storefront UI renders", () => {
    const dto = toStorefrontProduct(product);
    expect(Object.keys(dto).toSorted()).toEqual(
      [
        "allergens",
        "categoryId",
        "description",
        "id",
        "imageUrl",
        "name",
        "price",
        "stock",
        "suggestAddOns",
      ].toSorted(),
    );
    expect(dto).not.toHaveProperty("unitCost");
    expect(dto).not.toHaveProperty("businessId");
    expect(dto).not.toHaveProperty("createdAt");
    expect(storefrontProductSchema.safeParse(dto).success).toBe(true);
  });

  it("does not forward unknown extra fields", () => {
    const dto = toStorefrontProduct({ ...product, supplierSecret: "x" } as Product);
    expect(dto).not.toHaveProperty("supplierSecret");
  });

  it("caps stock at the per-line order limit and floors it at zero", () => {
    expect(toStorefrontProduct({ ...product, stock: 5000 }).stock).toBe(MAX_QUANTITY_PER_LINE);
    expect(toStorefrontProduct({ ...product, stock: 7 }).stock).toBe(7);
    expect(toStorefrontProduct({ ...product, stock: -3 }).stock).toBe(0);
  });
});
