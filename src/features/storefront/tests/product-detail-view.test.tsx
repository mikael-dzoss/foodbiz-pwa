import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductDetailView } from "../components/product-detail-view";
import { CartProvider } from "../context/cart-context";
import { enDictionary } from "@/domain/i18n";
import type { StorefrontProductData } from "../catalog-data";

const sampleProductData: StorefrontProductData = {
  product: {
    id: "prod-pastry-1",
    businessId: "biz-1",
    categoryId: "cat-1",
    name: "Artisan Sourdough Loaf",
    description: "Slow-fermented artisan sourdough bread with crispy crust",
    price: 650,
    unitCost: 200,
    stock: 8,
    visible: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  categoryName: "Artisan Breads",
  business: {
    id: "biz-1",
    name: "The Rustic Baker",
    slug: "rustic-baker",
    description: "Traditional sourdough and pastries",
    phone: "+33 6 12 34 56 78",
    email: "contact@rusticbaker.fr",
    whatsappNumber: "33612345678",
    address: "12 Rue de la Paix, Paris",
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
    serviceTypes: {
      pickup: true,
      delivery: true,
      dineIn: false,
    },
    openingHours: "07:30 - 19:30",
    orderTimingAsap: true,
    orderTimingScheduled: true,
    orderTimingTimeOptional: true,
    deliveryFee: 0,
    minOrderAmount: 0,
    revolutRevtag: "",
    weroIdentifier: "",
    paymentMethods: {
      cash: true,
      revolut: true,
      wero: true,
    },
    paymentInstructionsEn: "",
    paymentInstructionsFr: "",
    inAppAlerts: true,
    soundAlerts: true,
  },
  isAcceptingOrders: true,
  isOpen: true,
};

describe("ProductDetailView (#81, #82)", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders product name, price, description, category, and business breadcrumb", () => {
    render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Artisan Sourdough Loaf" })).toBeDefined();
    expect(
      screen.getByText("Slow-fermented artisan sourdough bread with crispy crust"),
    ).toBeDefined();
    expect(screen.getByText("Artisan Breads")).toBeDefined();
    expect(screen.getAllByText(/6,50\s*€|€6\.50|6\.50\s*€/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(enDictionary.storefront.inStock)).toBeDefined();
  });

  it("allows incrementing quantity with stepper and adds selected quantity to cart", () => {
    render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    // Increase quantity using stepper
    const incButton = screen.getByRole("button", { name: /increase quantity/i });
    fireEvent.click(incButton);
    fireEvent.click(incButton); // quantity is now 3

    // Click add to cart
    const addButton = screen.getByRole("button", {
      name: new RegExp(`${enDictionary.storefront.addToCart}`),
    });
    fireEvent.click(addButton);

    // Should display added feedback and in-cart note
    expect(screen.getByText(enDictionary.storefront.addedToCart)).toBeDefined();
    expect(screen.getByText(/Currently in your cart:/i)).toBeDefined();
  });

  it("disables add button and renders out-of-stock badge when stock is 0", () => {
    const outOfStockData: StorefrontProductData = {
      ...sampleProductData,
      product: {
        ...sampleProductData.product,
        stock: 0,
      },
    };

    render(
      <CartProvider>
        <ProductDetailView
          productData={outOfStockData}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    const outBadges = screen.getAllByText(enDictionary.storefront.outOfStock);
    expect(outBadges.length).toBeGreaterThanOrEqual(1);

    const button = screen.getByRole("button", { name: enDictionary.storefront.outOfStock });
    expect(button).toHaveProperty("disabled", true);
  });

  it("displays store status alert banner when store is not accepting orders", () => {
    const closedData: StorefrontProductData = {
      ...sampleProductData,
      isAcceptingOrders: false,
    };

    render(
      <CartProvider>
        <ProductDetailView productData={closedData} locale="en" dict={enDictionary.storefront} />
      </CartProvider>,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.notAcceptingOrdersBanner)).toBeDefined();
  });

  it("renders Cook's Recommendation card, Ingredients & Sourcing with SoonBadge, and Allergen Notice", () => {
    render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    // Cook's Recommendation
    expect(screen.getByText(enDictionary.storefront.cooksRecommendation)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.cooksTip)).toBeDefined();

    // Ingredients & Sourcing (planned future feature with soon badge)
    expect(screen.getByText(enDictionary.storefront.ingredientsAndSourcing)).toBeDefined();

    // Allergen Notice (planned future feature with soon badge)
    expect(screen.getByText(enDictionary.storefront.allergenNotice)).toBeDefined();
    expect(screen.getByText("Gluten (Wheat)")).toBeDefined();

    // Soon badges are displayed on the upcoming sections
    const soonBadges = screen.getAllByText("Soon");
    expect(soonBadges.length).toBeGreaterThanOrEqual(2);
  });
});
