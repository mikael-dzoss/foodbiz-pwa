import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontCartBar } from "../components/storefront-cart-bar";
import { StorefrontCatalogView } from "../components/storefront-catalog-view";
import { CartProvider, useCart, resetCartStore } from "../context/cart-context";
import { MenuSearchProvider } from "../context/menu-search-context";
import { StorefrontHeader } from "../components/storefront-header";
import { enDictionary, frDictionary } from "@/domain/i18n";
import { DEMO_PRODUCT, demoBusiness, demoCategories } from "@/lib/repositories/mock/fixtures";
import type { StorefrontCatalogData } from "../catalog-data";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/en",
}));

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
    name: demoBusiness.name,
    description: demoBusiness.description,
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
    leadTimeValue: 1,
    leadTimeUnit: "business_days",
    revolutRevtag: "",
    weroIdentifier: "",
    paymentMethods: { cash: true, revolut: true, wero: true },
    paymentInstructionsEn: "",
    paymentInstructionsFr: "",
    inAppAlerts: true,
    soundAlerts: true,
    timezone: "Europe/Paris",
  },
  categories: [
    {
      id: "cat-1",
      name: demoCategories[0].name,
      sortOrder: 1,
      role: "regular" as const,
    },
    {
      id: "cat-2",
      name: demoCategories[2].name,
      sortOrder: 2,
      role: "snacks" as const,
    },
  ],
  groupedCategories: [
    {
      id: "cat-1",
      name: demoCategories[0].name,
      sortOrder: 1,
      products: [
        {
          id: "prod-1",
          categoryId: "cat-1",
          name: DEMO_PRODUCT.pouletBraise.name,
          description: DEMO_PRODUCT.pouletBraise.description,
          price: 500,
          stock: 10,
          allergens: [],
          suggestAddOns: true,
        },
      ],
    },
    {
      id: "cat-2",
      name: demoCategories[2].name,
      sortOrder: 2,
      products: [
        {
          id: "prod-2",
          categoryId: "cat-2",
          name: DEMO_PRODUCT.beignetsSouffles.name,
          description: DEMO_PRODUCT.beignetsSouffles.description,
          price: 250,
          stock: 15,
          allergens: [],
          suggestAddOns: true,
        },
      ],
    },
  ],
  featuredProducts: [],
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
          name: DEMO_PRODUCT.pouletBraise.name,
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
    it("puts featured first in tabs and Menu sheet, observes it and focuses its heading", () => {
      const product = mockCatalog.groupedCategories[0].products[0];
      render(
        <CartProvider>
          <StorefrontCatalogView
            catalog={{ ...mockCatalog, featuredProducts: [product] }}
            locale="fr"
            dict={frDictionary.storefront}
          />
        </CartProvider>,
      );
      const heading = screen.getByRole("heading", {
        level: 2,
        name: frDictionary.storefront.featuredItems,
      });
      expect(heading.getAttribute("tabindex")).toBe("-1");
      expect(heading.className).toContain("scroll-mt-28");
      const featured = document.getElementById("featured")!;
      const spy = MockIntersectionObserver.instances.find((observer) =>
        observer.observedElements.includes(featured),
      );
      expect(spy).toBeDefined();
      const sentinel = screen.getByTestId("category-nav-sentinel");
      expect(featured.contains(sentinel)).toBe(true);
      const sentinelObserver = MockIntersectionObserver.instances.find((observer) =>
        observer.observedElements.includes(sentinel),
      )!;
      act(() =>
        sentinelObserver.trigger([
          {
            target: sentinel,
            isIntersecting: false,
            boundingClientRect: { top: -20 } as DOMRectReadOnly,
          },
        ]),
      );
      const nav = screen.getByRole("navigation", {
        name: frDictionary.storefront.browseCategories,
      });
      const tab = within(nav).getAllByRole("button")[0];
      expect(tab.textContent).toBe(frDictionary.storefront.featuredItems);
      act(() => spy!.trigger([{ target: featured, isIntersecting: true }]));
      expect(tab.getAttribute("aria-current")).toBe("true");
      fireEvent.click(tab);
      expect(document.activeElement).toBe(heading);
      fireEvent.click(screen.getByTestId("category-nav-menu-button"));
      const menu = screen.getByRole("navigation", { name: frDictionary.storefront.menu });
      const firstItem = within(menu).getAllByRole("button")[0];
      expect(firstItem.textContent).toBe(frDictionary.storefront.featuredItems);
      fireEvent.click(firstItem);
      expect(document.activeElement).toBe(heading);
    });

    it("hides featured and omits its tab when its list is empty", () => {
      render(
        <CartProvider>
          <StorefrontCatalogView catalog={mockCatalog} locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );
      expect(screen.queryByRole("heading", { name: "Featured items" })).toBeNull();
      expect(screen.queryByTestId("featured-carousel")).toBeNull();
    });
    it("renders all categories and opens full-screen menu search overlay from the header launcher (#203, #229)", () => {
      render(
        <CartProvider>
          <MenuSearchProvider>
            <StorefrontHeader locale="en" dict={enDictionary.storefront} />
            <StorefrontCatalogView
              catalog={mockCatalog}
              locale="en"
              dict={enDictionary.storefront}
            />
          </MenuSearchProvider>
        </CartProvider>,
      );

      expect(screen.getByRole("heading", { level: 1, name: demoBusiness.name })).toBeDefined();
      expect(screen.getByRole("heading", { level: 2, name: demoCategories[0].name })).toBeDefined();
      expect(screen.getByRole("heading", { level: 2, name: demoCategories[2].name })).toBeDefined();
      expect(screen.getByText(DEMO_PRODUCT.pouletBraise.name)).toBeDefined();
      expect(screen.getByText(DEMO_PRODUCT.beignetsSouffles.name)).toBeDefined();

      // Inline search input is removed; the only launcher sits in the header (#229)
      expect(screen.queryByTestId("catalog-search-input")).toBeNull();
      const launcher = screen.getByRole("button", { name: "Search the menu" });
      expect(screen.getByRole("banner").contains(launcher)).toBe(true);
      expect(launcher.getAttribute("data-testid")).toBe("catalog-search-launcher");

      // Open full-screen search dialog
      fireEvent.click(launcher);

      const dialog = screen.getByRole("dialog", { name: "Search the menu" });
      expect(dialog).toBeDefined();

      const searchInput = screen.getByTestId("menu-search-input") as HTMLInputElement;
      expect(searchInput.getAttribute("placeholder")).toBe("Search the menu");
      expect(document.activeElement).toBe(searchInput);

      // Initial state when query is empty shows hint and no product results
      expect(screen.getByTestId("menu-search-initial-hint")).toBeDefined();
      expect(screen.queryByTestId("menu-search-results")).toBeNull();
      expect(screen.queryByTestId("menu-search-clear-button")).toBeNull();

      // Typing filters products across categories and shows results count + clear button
      fireEvent.change(searchInput, { target: { value: "e" } });
      expect(screen.getByTestId("menu-search-results-count").textContent).toContain("2 results");

      fireEvent.change(searchInput, { target: { value: DEMO_PRODUCT.beignetsSouffles.name } });
      expect(screen.getByTestId("menu-search-results-count").textContent).toContain("1 result");
      expect(screen.getByTestId("menu-search-results").textContent).toContain(
        DEMO_PRODUCT.beignetsSouffles.name,
      );
      expect(screen.getByTestId("menu-search-results").textContent).not.toContain(
        DEMO_PRODUCT.pouletBraise.name,
      );

      // Matching category name shows all products in that category
      fireEvent.change(searchInput, { target: { value: "viandes" } });
      expect(screen.getByTestId("menu-search-results-count").textContent).toContain("1 result");
      expect(screen.getByTestId("menu-search-results").textContent).toContain(
        DEMO_PRODUCT.pouletBraise.name,
      );

      // Search for non-existent product shows empty state with query
      fireEvent.change(searchInput, { target: { value: "Donut" } });
      expect(screen.getByTestId("menu-search-empty-state").textContent).toContain(
        'No results for "Donut"',
      );

      // Clear button resets query and keeps focus on search input
      const clearBtn = screen.getByTestId("menu-search-clear-button");
      fireEvent.click(clearBtn);
      expect(searchInput.value).toBe("");
      expect(screen.getByTestId("menu-search-initial-hint")).toBeDefined();
      expect(document.activeElement).toBe(searchInput);

      // Back button closes dialog and restores focus to launcher
      fireEvent.click(screen.getByTestId("menu-search-back-button"));
      expect(screen.queryByRole("dialog", { name: "Search the menu" })).toBeNull();
      expect(document.activeElement).toBe(launcher);
    });

    it("closes full-screen search on Escape and keeps the sticky CategoryNav free of launchers (#229)", () => {
      render(
        <CartProvider>
          <MenuSearchProvider>
            <StorefrontHeader locale="en" dict={enDictionary.storefront} />
            <StorefrontCatalogView
              catalog={mockCatalog}
              locale="en"
              dict={enDictionary.storefront}
            />
          </MenuSearchProvider>
        </CartProvider>,
      );

      // Scroll past sentinel so sticky CategoryNav is shown
      const sentinel = screen.getByTestId("category-nav-sentinel");
      const sentinelObserver = MockIntersectionObserver.instances.find((obs) =>
        obs.observedElements.includes(sentinel),
      );
      act(() => {
        sentinelObserver!.trigger([
          {
            target: sentinel,
            isIntersecting: false,
            boundingClientRect: { top: -20 } as DOMRectReadOnly,
          },
        ]);
      });

      const stickyNav = screen.getByTestId("sticky-category-nav");
      const launchers = screen.getAllByRole("button", { name: "Search the menu" });
      expect(launchers).toHaveLength(1);
      const headerLauncher = launchers[0];
      expect(stickyNav.contains(headerLauncher)).toBe(false);

      fireEvent.click(headerLauncher);
      expect(screen.getByRole("dialog", { name: "Search the menu" })).toBeDefined();

      // Press Escape to close
      fireEvent.keyDown(screen.getByRole("dialog", { name: "Search the menu" }), {
        key: "Escape",
        code: "Escape",
      });
      expect(screen.queryByRole("dialog", { name: "Search the menu" })).toBeNull();
      expect(document.activeElement).toBe(headerLauncher);
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

      const secondHeading = screen.getByRole("heading", { level: 2, name: demoCategories[2].name });
      expect(secondHeading.getAttribute("tabindex")).toBe("-1");
      expect(secondHeading.className).toContain("scroll-mt-28");
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(document.activeElement).toBe(secondHeading);

      // Opening Menu sheet and selecting a category also scrolls and moves focus to heading
      fireEvent.click(screen.getByTestId("category-nav-menu-button"));
      const sheet = screen.getByTestId("category-nav-sheet");
      expect(sheet.textContent).toContain("08:00 - 18:00");

      scrollIntoViewMock.mockClear();
      fireEvent.click(screen.getByTestId("category-nav-sheet-item-cat-1"));

      const firstHeading = screen.getByRole("heading", { level: 2, name: demoCategories[0].name });
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(document.activeElement).toBe(firstHeading);
    });

    it("renders Shop Info link directing to the shop info page", () => {
      render(
        <CartProvider>
          <StorefrontCatalogView catalog={mockCatalog} locale="en" dict={enDictionary.storefront} />
        </CartProvider>,
      );

      const shopInfoLink = screen.getByRole("link", {
        name: /Store Info/i,
      });
      expect(shopInfoLink.getAttribute("href")).toBe("/en/info");

      const categoryGroup = screen.getByTestId("category-group-cat-1");
      expect(categoryGroup.className).toContain("divide-y");
      expect(categoryGroup.className).toContain("rounded-xl");
    });

    it("renders empty catalog message when there are no visible products", () => {
      render(
        <CartProvider>
          <StorefrontCatalogView
            catalog={{ ...mockCatalog, groupedCategories: [], totalVisibleProducts: 0 }}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>,
      );

      expect(screen.getByText(enDictionary.storefront.noProductsInCategory)).toBeDefined();
    });

    it("keeps catalog and featured add buttons enabled when closed but accepting orders, and disables them when not accepting (#350)", () => {
      const product = mockCatalog.groupedCategories[0].products[0];
      const closedAcceptingCatalog: StorefrontCatalogData = {
        ...mockCatalog,
        featuredProducts: [product],
        isAcceptingOrders: true,
        isOpen: false,
      };

      const { unmount } = render(
        <CartProvider>
          <StorefrontCatalogView
            catalog={closedAcceptingCatalog}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>,
      );

      const catalogAddBtn = screen.getByTestId("add-to-cart-prod-1") as HTMLButtonElement;
      const featuredAddBtn = screen.getByTestId("featured-add-to-cart-prod-1") as HTMLButtonElement;
      expect(catalogAddBtn.disabled).toBe(false);
      expect(featuredAddBtn.disabled).toBe(false);

      fireEvent.click(catalogAddBtn);
      expect(
        screen.getByRole("link", { name: new RegExp(enDictionary.storefront.viewCart, "i") }),
      ).toBeDefined();

      unmount();
      resetCartStore();

      const pausedCatalog: StorefrontCatalogData = {
        ...mockCatalog,
        featuredProducts: [product],
        isAcceptingOrders: false,
        isOpen: false,
      };

      render(
        <CartProvider>
          <StorefrontCatalogView
            catalog={pausedCatalog}
            locale="en"
            dict={enDictionary.storefront}
          />
        </CartProvider>,
      );

      expect((screen.getByTestId("add-to-cart-prod-1") as HTMLButtonElement).disabled).toBe(true);
      expect(
        (screen.getByTestId("featured-add-to-cart-prod-1") as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });
});
