import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductCatalogCard } from "../components/product-catalog-card";
import { CartProvider } from "../context/cart-context";
import { enDictionary, frDictionary } from "@/domain/i18n";
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

  it("renders product name, price, 2-line clamped description on the left and placeholder image with icon-only + button on the right", () => {
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
    const desc = screen.getByText("Filled with rich frangipane and toasted almond flakes");
    expect(desc.className).toContain("line-clamp-2");
    expect(screen.getByText(/3,80\s*€|€3\.80|3\.80\s*€/)).toBeDefined();
    expect(screen.getByTestId(`product-image-placeholder-${sampleProduct.id}`)).toBeDefined();

    const addBtn = screen.getByRole("button", {
      name: `${enDictionary.storefront.addToCart}: ${sampleProduct.name}`,
    });
    expect(addBtn.className).toContain("min-h-11");
    expect(addBtn.className).toContain("min-w-11");
    expect(addBtn.className).toContain("rounded-full");
  });

  it("links both the product name and image container to the product detail page", () => {
    const productWithImg: Product = {
      ...sampleProduct,
      imageUrl: "https://example.com/croissant.jpg",
    };

    render(
      <CartProvider>
        <ProductCatalogCard product={productWithImg} locale="en" dict={enDictionary.storefront} />
      </CartProvider>,
    );

    const nameLink = screen.getByRole("link", { name: sampleProduct.name });
    expect(nameLink.getAttribute("href")).toBe(`/en/p/${sampleProduct.id}`);

    const imageLink = screen.getByTestId(`product-image-link-${sampleProduct.id}`);
    expect(imageLink.getAttribute("href")).toBe(`/en/p/${sampleProduct.id}`);
    expect(screen.getByAltText(sampleProduct.name)).toBeDefined();
  });

  it("displays low stock text when stock is at or below threshold", () => {
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

  it("renders out-of-stock text and disables the + button with accessible label when stock is 0", () => {
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

    expect(screen.getByText(enDictionary.storefront.outOfStock)).toBeDefined();

    const button = screen.getByRole("button", {
      name: `${enDictionary.storefront.addToCart}: ${outOfStockProduct.name}`,
    });
    expect(button).toHaveProperty("disabled", true);
  });

  it("adds product to cart on button click and shows temporary feedback", () => {
    vi.useFakeTimers();
    try {
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

      act(() => {
        vi.advanceTimersByTime(1300);
      });

      expect(screen.getByText(enDictionary.storefront.addToCart)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
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

  it("renders French copy and supports data-URL image without description", () => {
    const productNoDesc: Product = {
      ...sampleProduct,
      id: "prod-fr",
      description: null,
      stock: 1,
      imageUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    };

    render(
      <CartProvider>
        <ProductCatalogCard
          product={productNoDesc}
          locale="fr"
          dict={frDictionary.storefront}
          priority={true}
        />
      </CartProvider>,
    );

    const addButton = screen.getByRole("button", {
      name: `${frDictionary.storefront.addToCart}: ${productNoDesc.name}`,
    });
    fireEvent.click(addButton);

    // Stock is 1, so after adding 1 item, button becomes disabled
    expect(addButton).toHaveProperty("disabled", true);
  });
});
