import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductDetailView } from "../components/product-detail-view";
import { CartProvider, resetCartStore, useCart } from "../context/cart-context";
import { enDictionary, frDictionary } from "@/domain/i18n";
import type { AddOnCandidates } from "@/domain/add-ons";
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

describe("ProductDetailView (#81, #82, #202, #206, #207)", () => {
  afterEach(() => {
    cleanup();
    resetCartStore();
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
    const addButton = screen.getByTestId("product-add-button");
    expect(addButton.textContent).toContain("Add 3 to cart");
    fireEvent.click(addButton);

    // Should display added feedback and in-cart note
    expect(screen.getByText(enDictionary.storefront.addedToCart)).toBeDefined();
    expect(screen.getByText(/Currently in your cart:/i)).toBeDefined();
  });

  it("renders the optional Drinks group below the description card in EN and FR and hides it when addOns is null", () => {
    const sampleDrinks: AddOnCandidates = {
      kind: "drinks",
      products: [
        {
          ...sampleProductData.product,
          id: "drink-espresso",
          name: "Double Espresso",
          price: 220,
          stock: 10,
          imageUrl: "/images/espresso.jpg",
        },
        {
          ...sampleProductData.product,
          id: "drink-juice",
          name: "Fresh Orange Juice",
          price: 400,
          stock: 5,
          imageUrl: null,
        },
      ],
    };

    const { unmount } = render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          addOns={{ kind: "drinks", products: [] }}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );
    expect(screen.queryByTestId("product-addons-group")).toBeNull();
    unmount();

    const { unmount: unmountEn } = render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          addOns={sampleDrinks}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    const group = screen.getByTestId("product-addons-group");
    expect(group.tagName).toBe("FIELDSET");
    expect(screen.getByText("Drinks")).toBeDefined();
    expect(screen.getByText("Choose any")).toBeDefined();
    expect(screen.getByTestId("product-addons-optional-badge").textContent).toBe("Optional");
    expect(screen.getByRole("checkbox", { name: /Double Espresso/i })).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /Fresh Orange Juice/i })).toBeDefined();
    expect(screen.getByTestId("product-addon-placeholder-drink-juice")).toBeDefined();
    expect(screen.getByText(/\+€2\.20|\+2,20\s*€/)).toBeDefined();

    const cooksEl = screen.getByText(enDictionary.storefront.cooksRecommendation);
    expect(cooksEl.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    unmountEn();

    render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          addOns={sampleDrinks}
          locale="fr"
          dict={frDictionary.storefront}
        />
      </CartProvider>,
    );

    expect(screen.getByText("Boissons")).toBeDefined();
    expect(screen.getByText("Au choix")).toBeDefined();
    expect(screen.getByTestId("product-addons-optional-badge").textContent).toBe("Optionnel");
    expect(screen.getByTestId("product-add-button").textContent).toMatch(
      /Ajouter 1 au panier • 6,50\s*€/,
    );
  });

  it("updates CTA total when drinks are selected, adds separate cart lines with main quantity, and resets selections", () => {
    const sampleDrinks: AddOnCandidates = {
      kind: "drinks",
      products: [
        {
          ...sampleProductData.product,
          id: "drink-espresso",
          name: "Double Espresso",
          price: 220,
          stock: 10,
          imageUrl: "/images/espresso.jpg",
        },
        {
          ...sampleProductData.product,
          id: "drink-juice",
          name: "Fresh Orange Juice",
          price: 400,
          stock: 3,
          imageUrl: "/images/orange-juice.jpg",
        },
      ],
    };

    function CartInspector() {
      const { items } = useCart();
      return (
        <ul data-testid="cart-inspector">
          {items.map((item) => (
            <li key={item.productId} data-testid={`cart-line-${item.productId}`}>
              {item.name}:{item.quantity}:{item.price}
            </li>
          ))}
        </ul>
      );
    }

    render(
      <CartProvider>
        <ProductDetailView
          productData={sampleProductData}
          addOns={sampleDrinks}
          locale="en"
          dict={enDictionary.storefront}
        />
        <CartInspector />
      </CartProvider>,
    );

    const addButton = screen.getByTestId("product-add-button");
    expect(addButton.textContent).toContain("Add 1 to cart • €6.50");

    // Tick both drinks: (650 + 220 + 400) * 1 = 1270 (€12.70)
    const espressoCheckbox = screen.getByRole("checkbox", { name: /Double Espresso/i });
    const juiceCheckbox = screen.getByRole("checkbox", { name: /Fresh Orange Juice/i });
    fireEvent.click(espressoCheckbox);
    fireEvent.click(juiceCheckbox);
    expect(addButton.textContent).toContain("Add 1 to cart • €12.70");

    // Untick juice: (650 + 220) * 1 = 870 (€8.70)
    fireEvent.click(juiceCheckbox);
    expect(addButton.textContent).toContain("Add 1 to cart • €8.70");

    // Increase quantity to 2: (650 + 220) * 2 = 1740 (€17.40)
    const incButton = screen.getByRole("button", { name: /increase quantity/i });
    fireEvent.click(incButton);
    expect(addButton.textContent).toContain("Add 2 to cart • €17.40");

    // Add to cart -> creates main line (qty 2) + espresso line (qty 2) and resets selection
    fireEvent.click(addButton);

    expect(screen.getByTestId("cart-line-prod-pastry-1").textContent).toBe(
      "Artisan Sourdough Loaf:2:650",
    );
    expect(screen.getByTestId("cart-line-drink-espresso").textContent).toBe(
      "Double Espresso:2:220",
    );
    expect(espressoCheckbox.getAttribute("aria-checked")).toBe("false");
  });

  it("disables add-on checkboxes when the store is not accepting orders", () => {
    const sampleDrinks: AddOnCandidates = {
      kind: "drinks",
      products: [
        {
          ...sampleProductData.product,
          id: "drink-espresso",
          name: "Double Espresso",
          price: 220,
          stock: 10,
          imageUrl: "/images/espresso.jpg",
        },
      ],
    };

    render(
      <CartProvider>
        <ProductDetailView
          productData={{ ...sampleProductData, isAcceptingOrders: false }}
          addOns={sampleDrinks}
          locale="en"
          dict={enDictionary.storefront}
        />
      </CartProvider>,
    );

    const group = screen.getByTestId("product-addons-group") as HTMLFieldSetElement;
    expect(group.disabled).toBe(true);
    const checkbox = screen.getByRole("checkbox", { name: /Double Espresso/i });
    expect(checkbox).toHaveProperty("disabled", true);
  });

  it("renders the Accompaniments group on a drink product in EN and FR and adds selected snacks as separate cart lines (#207)", () => {
    const drinkProductData: StorefrontProductData = {
      ...sampleProductData,
      product: {
        ...sampleProductData.product,
        id: "prod-drink-1",
        name: "Double Espresso",
        price: 220,
      },
      categoryName: "Hot & Cold Beverages",
    };
    const sampleAccompaniments: AddOnCandidates = {
      kind: "accompaniments",
      products: [
        {
          ...sampleProductData.product,
          id: "snack-madeleines",
          name: "Madeleines x3",
          price: 300,
          stock: 20,
          imageUrl: null,
        },
        {
          ...sampleProductData.product,
          id: "snack-cookies",
          name: "Mini Cookies",
          price: 250,
          stock: 15,
          imageUrl: null,
        },
      ],
    };

    const { unmount } = render(
      <CartProvider>
        <ProductDetailView
          productData={drinkProductData}
          addOns={sampleAccompaniments}
          locale="fr"
          dict={frDictionary.storefront}
        />
      </CartProvider>,
    );

    expect(screen.getByText("Accompagnements")).toBeDefined();
    expect(screen.getByText("Au choix")).toBeDefined();
    expect(screen.getByTestId("product-addons-optional-badge").textContent).toBe("Optionnel");
    unmount();

    function CartInspector() {
      const { items } = useCart();
      return (
        <ul data-testid="cart-inspector">
          {items.map((item) => (
            <li key={item.productId} data-testid={`cart-line-${item.productId}`}>
              {item.name}:{item.quantity}:{item.price}
            </li>
          ))}
        </ul>
      );
    }

    render(
      <CartProvider>
        <ProductDetailView
          productData={drinkProductData}
          addOns={sampleAccompaniments}
          locale="en"
          dict={enDictionary.storefront}
        />
        <CartInspector />
      </CartProvider>,
    );

    expect(screen.getByText("Accompaniments")).toBeDefined();
    const madeleinesCheckbox = screen.getByRole("checkbox", { name: /Madeleines x3/i });
    fireEvent.click(madeleinesCheckbox);

    const addButton = screen.getByTestId("product-add-button");
    expect(addButton.textContent).toContain("Add 1 to cart • €5.20");
    fireEvent.click(addButton);

    expect(screen.getByTestId("cart-line-prod-drink-1").textContent).toBe("Double Espresso:1:220");
    expect(screen.getByTestId("cart-line-snack-madeleines").textContent).toBe(
      "Madeleines x3:1:300",
    );
    expect(madeleinesCheckbox.getAttribute("aria-checked")).toBe("false");
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
