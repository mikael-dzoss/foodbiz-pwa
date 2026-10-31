import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductCatalogCard } from "../components/product-catalog-card";
import { CartProvider } from "../context/cart-context";
import { enDictionary } from "@/domain/i18n";
import type { Product } from "@/domain/product";

const sampleProduct: Product = {
  id: "prod-pastry-1",
  businessId: "biz-1",
  categoryId: "cat-1",
  name: "Almond Croissant",
  description: "Filled with rich frangipane and toasted almond flakes",
  price: 380,
  unitCost: 150,
  stock: 12,
  visible: true,
  allergens: [],
  suggestAddOns: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("ProductCatalogCard (#80, #81, #82)", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders product name, description, category, and formatted price", () => {
    render(
      <CartProvider>
        <ProductCatalogCard
          product={sampleProduct}
          categoryName="Pastries"
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    expect(screen.getByText("Almond Croissant")).toBeDefined();
    expect(screen.getByText("Filled with rich frangipane and toasted almond flakes")).toBeDefined();
    expect(screen.getByText("Pastries")).toBeDefined();
    expect(screen.getByText(/3,80\s*€|€3\.80|3\.80\s*€/)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.inStock)).toBeDefined();
  });

  it("displays low stock badge when stock is at or below threshold", () => {
    const lowStockProduct: Product = {
      ...sampleProduct,
      id: "prod-low",
      stock: 3,
    };

    render(
      <CartProvider>
        <ProductCatalogCard
          product={lowStockProduct}
          locale="en"
          dict={enDictionary.storefront}
          lowStockThreshold={5}
        />
      </CartProvider>,
    );

    expect(screen.getByText(new RegExp(`3 ${enDictionary.storefront.unitsLeft}`))).toBeDefined();
  });

  it("renders out-of-stock badge and disables add button when stock is 0", () => {
    const outOfStockProduct: Product = {
      ...sampleProduct,
      id: "prod-out",
      stock: 0,
    };

    render(
      <CartProvider>
        <ProductCatalogCard
          product={outOfStockProduct}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    const badges = screen.getAllByText(enDictionary.storefront.outOfStock);
    expect(badges.length).toBeGreaterThanOrEqual(1);

    const button = screen.getByRole("button", { name: enDictionary.storefront.outOfStock });
    expect(button).toHaveProperty("disabled", true);
  });

  it("adds product to cart on button click and shows temporary feedback", () => {
    render(
      <CartProvider>
        <ProductCatalogCard product={sampleProduct} locale="en" dict={enDictionary.storefront} />
      </CartProvider>,
    );

    const addButton = screen.getByRole("button", {
      name: `${enDictionary.storefront.addToCart}: ${sampleProduct.name}`,
    });

    fireEvent.click(addButton);

    expect(screen.getByText(enDictionary.storefront.addedToCart)).toBeDefined();
  });

  it("disables add button when disabled prop is true (e.g. store closed)", () => {
    render(
      <CartProvider>
        <ProductCatalogCard
          product={sampleProduct}
          locale="en"
          dict={enDictionary.storefront}
          disabled={true}
        />
      </CartProvider>,
    );

    const addButton = screen.getByRole("button", {
      name: `${enDictionary.storefront.addToCart}: ${sampleProduct.name}`,
    });
    expect(addButton).toHaveProperty("disabled", true);
  });
});
