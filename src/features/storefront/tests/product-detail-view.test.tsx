import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductDetailView } from "../components/product-detail-view";
import { CartProvider } from "../context/cart-context";
import { enDictionary, frDictionary } from "@/domain/i18n";
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
    allergens: [],
    suggestAddOns: true,
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

describe("ProductDetailView (#81, #82, #202)", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("renders product name, price, description, category, and omits removed legacy cards", () => {
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
    expect(screen.getByText(enDictionary.storefront.cooksRecommendation)).toBeDefined();
    expect(screen.getByText(enDictionary.storefront.cooksTip)).toBeDefined();

    // Removed sections (#202): logistics/address card, ingredients card, Soon allergens card
    expect(screen.queryByText("12 Rue de la Paix, Paris")).toBeNull();
    expect(screen.queryByText(/Ingredients & Sourcing/i)).toBeNull();
    expect(screen.queryByText(/Allergen Notice/i)).toBeNull();
    expect(screen.queryByText("Soon")).toBeNull();
  });

  it("hides the allergens list when product.allergens is empty", () => {
    render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    expect(screen.queryByRole("list", { name: "Allergens" })).toBeNull();
    expect(screen.queryByTestId("product-allergens-list")).toBeNull();
  });

  it("renders EU-14 allergen badges in an accessible list under description and before Cook's Recommendation in EN and FR", () => {
    const withAllergens: StorefrontProductData = {
      ...sampleProductData,
      product: {
        ...sampleProductData.product,
        allergens: ["gluten", "milk", "eggs", "nuts"],
      },
    };

    const { unmount } = render(
      <CartProvider>
        <ProductDetailView productData={withAllergens} locale="en" dict={enDictionary.storefront} />
      </CartProvider>,
    );

    const listEn = screen.getByRole("list", { name: "Allergens" });
    expect(listEn).toBeDefined();
    expect(screen.getByTestId("product-allergen-gluten").textContent).toBe("Gluten");
    expect(screen.getByTestId("product-allergen-milk").textContent).toBe("Milk");
    expect(screen.getByTestId("product-allergen-eggs").textContent).toBe("Eggs");
    expect(screen.getByTestId("product-allergen-nuts").textContent).toBe("Nuts");

    // Verify DOM order: description -> allergens list -> Cook's Recommendation
    const descEl = screen.getByText("Slow-fermented artisan sourdough bread with crispy crust");
    const cooksEl = screen.getByText(enDictionary.storefront.cooksRecommendation);
    expect(descEl.compareDocumentPosition(listEn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(listEn.compareDocumentPosition(cooksEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    unmount();

    render(
      <CartProvider>
        <ProductDetailView productData={withAllergens} locale="fr" dict={frDictionary.storefront} />
      </CartProvider>,
    );

    expect(screen.getByRole("list", { name: "Allergènes" })).toBeDefined();
    expect(screen.getByTestId("product-allergen-milk").textContent).toBe("Lait");
    expect(screen.getByTestId("product-allergen-eggs").textContent).toBe("Œufs");
    expect(screen.getByTestId("product-allergen-nuts").textContent).toBe("Fruits à coque");
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

  it("disables add button with explanatory accessible label when store is closed or not accepting orders (without top banner)", () => {
    const pausedData: StorefrontProductData = {
      ...sampleProductData,
      isAcceptingOrders: false,
    };

    const { unmount } = render(
      <CartProvider>
        <ProductDetailView productData={pausedData} locale="en" dict={enDictionary.storefront} />
      </CartProvider>,
    );

    // Top banner is removed (#202)
    expect(screen.queryByRole("alert")).toBeNull();

    // Add button is disabled with explanatory text/label
    const pausedBtn = screen.getByTestId("product-add-button");
    expect(pausedBtn).toHaveProperty("disabled", true);
    expect(pausedBtn.textContent).toContain(enDictionary.storefront.notAcceptingOrdersShort);
    expect(pausedBtn.textContent).toContain(enDictionary.storefront.notAcceptingOrdersBanner);

    unmount();

    const closedHoursData: StorefrontProductData = {
      ...sampleProductData,
      isAcceptingOrders: true,
      isOpen: false,
    };

    render(
      <CartProvider>
        <ProductDetailView
          productData={closedHoursData}
          locale="fr"
          dict={frDictionary.storefront}
        />
      </CartProvider>,
    );

    const closedBtn = screen.getByTestId("product-add-button");
    expect(closedBtn).toHaveProperty("disabled", true);
    expect(closedBtn.textContent).toContain(frDictionary.storefront.storeClosedBadge);
    expect(closedBtn.textContent).toContain(frDictionary.storefront.storeClosedBanner);
  });
});
