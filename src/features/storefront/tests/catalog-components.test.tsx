import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryTabs } from "../components/category-tabs";
import { StorefrontCartBar } from "../components/storefront-cart-bar";
import { StorefrontCatalogView } from "../components/storefront-catalog-view";
import { CartProvider, useCart, resetCartStore } from "../context/cart-context";
import { enDictionary } from "@/domain/i18n";
import type { StorefrontCatalogData } from "../catalog-data";

const mockCatalog: StorefrontCatalogData = {
  business: {
    id: "biz-1",
    name: "La Boulangerie",
    slug: "la-boulangerie",
    description: "Artisan sourdough and pastries",
    currency: "EUR",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  settings: {
    businessId: "biz-1",
    currency: "EUR",
    dateFormat: "DD/MM/YYYY",
    lowStockThreshold: 5,
    taxPercentage: 10,
    notifications: true,
    acceptingOrders: true,
    serviceTypes: { pickup: true, delivery: true, dineIn: true },
    openingHours: "08:00 - 18:00",
    orderTimingAsap: true,
    orderTimingScheduled: true,
    orderTimingTimeOptional: true,
    deliveryFee: 200,
    minOrderAmount: 0,
    revolutRevtag: "",
    weroIdentifier: "",
    paymentMethods: { cash: true, revolut: true, wero: true },
    paymentInstructionsEn: "",
    paymentInstructionsFr: "",
    inAppAlerts: true,
    soundAlerts: true,
  },
  categories: [
    {
      id: "cat-1",
      businessId: "biz-1",
      name: "Breads",
      sortOrder: 1,
      role: "regular" as const,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "cat-2",
      businessId: "biz-1",
      name: "Pastries",
      sortOrder: 2,
      role: "regular" as const,
      createdAt: "2026-01-01T00:00:00Z",
    },
  ],
  groupedCategories: [
    {
      id: "cat-1",
      name: "Breads",
      sortOrder: 1,
      products: [
        {
          id: "prod-1",
          businessId: "biz-1",
          categoryId: "cat-1",
          name: "Sourdough Loaf",
          description: "Country sourdough loaf",
          price: 500,
          unitCost: 150,
          stock: 10,
          visible: true,
          allergens: [],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    },
    {
      id: "cat-2",
      name: "Pastries",
      sortOrder: 2,
      products: [
        {
          id: "prod-2",
          businessId: "biz-1",
          categoryId: "cat-2",
          name: "Croissant",
          description: "Butter croissant",
          price: 250,
          unitCost: 80,
          stock: 15,
          visible: true,
          allergens: [],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    },
  ],
  totalVisibleProducts: 2,
  isAcceptingOrders: true,
  isOpen: true,
  openingHoursText: "08:00 - 18:00",
};

function CartBarConsumer() {
  const { addItem } = useCart();
  return (
    <button
      onClick={() =>
        addItem({
          id: "prod-1",
          name: "Sourdough Loaf",
          price: 500,
          stock: 10,
        })
      }
      data-testid="add-cart-item"
    >
      Add
    </button>
  );
}

describe("Storefront UI components (#80, #81, #82, #83)", () => {
  beforeEach(() => {
    resetCartStore();
  });

  afterEach(() => {
    cleanup();
    resetCartStore();
  });

  describe("CategoryTabs", () => {
    it("renders All pill and categories, and handles selection", () => {
      const handleSelect = vi.fn();
      render(
        <CategoryTabs
          categories={mockCatalog.categories}
          selectedCategoryId="all"
          onSelectCategory={handleSelect}
          allLabel={enDictionary.storefront.allCategories}
        />,
      );

      expect(
        screen.getByRole("button", { name: enDictionary.storefront.allCategories }),
      ).toBeDefined();
      expect(screen.getByRole("button", { name: "Breads" })).toBeDefined();

      fireEvent.click(screen.getByRole("button", { name: "Breads" }));
      expect(handleSelect).toHaveBeenCalledWith("cat-1");
    });
  });

  describe("StorefrontCartBar", () => {
    it("renders item count and subtotal when cart has items", () => {
      render(
        <CartProvider>
          <div>
            <StorefrontCartBar locale="en" dict={enDictionary.storefront} />
            <CartBarConsumer />
          </div>
        </CartProvider>,
      );

      fireEvent.click(screen.getByTestId("add-cart-item"));

      expect(screen.getByText(/1 item/i)).toBeDefined();
      expect(screen.getByText(/€5.00|5.00\s*€/i)).toBeDefined();
      expect(
        screen.getByRole("link", { name: new RegExp(enDictionary.storefront.viewCart) }),
      ).toBeDefined();
    });

    it("renders null when totalCount is 0", () => {
      const { container } = render(
        <CartProvider>
          <StorefrontCartBar locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("StorefrontCatalogView", () => {
    it("renders catalog with products and filters by search query", () => {
      render(
        <CartProvider>
          <StorefrontCatalogView catalog={mockCatalog} locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );

      expect(screen.getByRole("heading", { level: 1, name: "La Boulangerie" })).toBeDefined();
      expect(screen.getByText("Sourdough Loaf")).toBeDefined();
      expect(screen.getByText("Croissant")).toBeDefined();

      // Search for "Croissant"
      const searchInput = screen.getByRole("searchbox");
      fireEvent.change(searchInput, { target: { value: "Croissant" } });

      expect(screen.queryByText("Sourdough Loaf")).toBeNull();
      expect(screen.getByText("Croissant")).toBeDefined();

      // Search for non-existent product
      fireEvent.change(searchInput, { target: { value: "Donut" } });
      expect(screen.getByText(enDictionary.storefront.noProductsFound)).toBeDefined();
    });

    it("filters products by category selection", () => {
      render(
        <CartProvider>
          <StorefrontCatalogView catalog={mockCatalog} locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );

      // Select "Breads"
      const breadsTab = screen.getByRole("button", { name: "Breads" });
      fireEvent.click(breadsTab);

      expect(screen.getByText("Sourdough Loaf")).toBeDefined();
      expect(screen.queryByText("Croissant")).toBeNull();
    });

    it("renders Bakery Info link directing to the shop info page", () => {
      render(
        <CartProvider>
          <StorefrontCatalogView catalog={mockCatalog} locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );

      const bakeryInfoLink = screen.getByRole("link", {
        name: /100% Organic Flours & Artisanal Baking/i,
      });
      expect(bakeryInfoLink.getAttribute("href")).toBe("/en/info");
    });
  });
});
