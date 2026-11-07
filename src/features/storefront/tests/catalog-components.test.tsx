import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontCartBar } from "../components/storefront-cart-bar";
import { StorefrontCatalogView } from "../components/storefront-catalog-view";
import { CartProvider, useCart, resetCartStore } from "../context/cart-context";
import { enDictionary } from "@/domain/i18n";
import type { StorefrontCatalogData } from "../catalog-data";

type ObserverCallback = IntersectionObserverCallback;

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: ObserverCallback;
  observedElements: Element[] = [];

  constructor(callback: ObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element) {
    this.observedElements.push(el);
  }

  unobserve(el: Element) {
    this.observedElements = this.observedElements.filter((item) => item !== el);
  }

  disconnect() {}

  trigger(entries: Array<Partial<IntersectionObserverEntry> & { target: Element }>) {
    this.callback(
      entries.map(
        (entry) =>
          ({
            isIntersecting: false,
            intersectionRatio: 0,
            boundingClientRect: entry.target.getBoundingClientRect(),
            intersectionRect: entry.target.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now(),
            ...entry,
          }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
  }
}

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
          suggestAddOns: true,
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
          suggestAddOns: true,
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

describe("Storefront UI components (#80, #81, #82, #83, #200)", () => {
  beforeEach(() => {
    resetCartStore();
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    resetCartStore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    it("renders all categories and filters products by non-sticky search query", () => {
      render(
        <CartProvider>
          <StorefrontCatalogView catalog={mockCatalog} locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );

      expect(screen.getByRole("heading", { level: 1, name: "La Boulangerie" })).toBeDefined();
      expect(screen.getByRole("heading", { level: 2, name: "Breads" })).toBeDefined();
      expect(screen.getByRole("heading", { level: 2, name: "Pastries" })).toBeDefined();
      expect(screen.getByText("Sourdough Loaf")).toBeDefined();
      expect(screen.getByText("Croissant")).toBeDefined();

      // Search input is rendered above categories (non-sticky) and filters across categories
      const searchInput = screen.getByRole("searchbox");
      fireEvent.change(searchInput, { target: { value: "Croissant" } });

      expect(screen.queryByText("Sourdough Loaf")).toBeNull();
      expect(screen.getByText("Croissant")).toBeDefined();

      // Search for non-existent product
      fireEvent.change(searchInput, { target: { value: "Donut" } });
      expect(screen.getByText(enDictionary.storefront.noProductsFound)).toBeDefined();
    });

    it("shows sticky CategoryNav only once the first category title has scrolled past and scrolls/focuses on selection", () => {
      const scrollIntoViewMock = vi.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

      render(
        <CartProvider>
          <StorefrontCatalogView catalog={mockCatalog} locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );

      // Initially hidden before scrolling past the first category title
      expect(screen.queryByTestId("sticky-category-nav")).toBeNull();
      expect(screen.queryByTestId("category-nav")).toBeNull();

      // Trigger sentinel IntersectionObserver as scrolled past top
      const sentinel = screen.getByTestId("category-nav-sentinel");
      const sentinelObserver = MockIntersectionObserver.instances.find((obs) =>
        obs.observedElements.includes(sentinel),
      );
      expect(sentinelObserver).toBeDefined();

      act(() => {
        sentinelObserver!.trigger([
          {
            target: sentinel,
            isIntersecting: false,
            boundingClientRect: { top: -20 } as DOMRectReadOnly,
          },
        ]);
      });

      const stickyWrapper = screen.getByTestId("sticky-category-nav");
      expect(stickyWrapper.className).toContain("sticky");
      expect(stickyWrapper.className).toContain("top-14");
      expect(screen.getByTestId("category-nav")).toBeDefined();

      // Clicking a horizontal tab scrolls to the section heading and focuses it
      scrollIntoViewMock.mockClear();
      fireEvent.click(screen.getByTestId("category-nav-tab-cat-2"));

      const pastriesHeading = screen.getByRole("heading", { level: 2, name: "Pastries" });
      expect(pastriesHeading.getAttribute("tabindex")).toBe("-1");
      expect(pastriesHeading.className).toContain("scroll-mt-28");
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(document.activeElement).toBe(pastriesHeading);

      // Opening Menu sheet and selecting a category also scrolls and moves focus to heading
      fireEvent.click(screen.getByTestId("category-nav-menu-button"));
      const sheet = screen.getByTestId("category-nav-sheet");
      expect(sheet.textContent).toContain("08:00 - 18:00");

      scrollIntoViewMock.mockClear();
      fireEvent.click(screen.getByTestId("category-nav-sheet-item-cat-1"));

      const breadsHeading = screen.getByRole("heading", { level: 2, name: "Breads" });
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(document.activeElement).toBe(breadsHeading);
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

      const categoryGroup = screen.getByTestId("category-group-cat-1");
      expect(categoryGroup.className).toContain("divide-y");
      expect(categoryGroup.className).toContain("rounded-xl");
    });
  });
});
