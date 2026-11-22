import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontShell } from "../components/storefront-shell";
import { useCart, resetCartStore } from "../context/cart-context";
import { enDictionary, frDictionary } from "@/domain/i18n";

let mockPathname = "/en";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

function AddItemTestButton() {
  const { addItem } = useCart();
  return (
    <button
      onClick={() =>
        addItem({
          id: "prod-baguette",
          name: "Tradition Baguette",
          price: 150,
          stock: 10,
        })
      }
    >
      Add Baguette
    </button>
  );
}

beforeEach(() => {
  resetCartStore();
  mockPathname = "/en/p/prod-baguette";
});

afterEach(() => {
  resetCartStore();
});

describe("Storefront Shell (#30)", () => {
  it("renders header with brand name, language switch, and cart button", () => {
    render(
      <StorefrontShell locale="en" dict={enDictionary.storefront} cartCount={0}>
        <div>Catalog Content</div>
      </StorefrontShell>,
    );

    expect(screen.getByText("Catalog Content")).toBeDefined();
    expect(screen.getByRole("banner")).toBeDefined();
    expect(
      screen.getByRole("link", { name: `FR - ${enDictionary.storefront.switchLanguage}` }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: /Cart - 0 items/i })).toBeDefined();
  });

  it.each([
    ["en", enDictionary, "Skip to content"],
    ["fr", frDictionary, "Aller au contenu"],
  ] as const)("starts with a localized skip link to main (%s)", (locale, dictionary, label) => {
    render(
      <StorefrontShell locale={locale} dict={dictionary.storefront}>
        <div>Catalog Content</div>
      </StorefrontShell>,
    );
    const skip = screen.getByRole("link", { name: label });
    expect(skip.getAttribute("href")).toBe("#main-content");
    expect(document.querySelector("a[href], button")).toBe(skip);
    expect(screen.getByRole("main").id).toBe("main-content");
    expect(screen.getByRole("main").getAttribute("tabindex")).toBe("-1");
  });

  it("displays badge with item count when cartCount > 0", () => {
    render(
      <StorefrontShell locale="en" dict={enDictionary.storefront} cartCount={3}>
        <div>Catalog Content</div>
      </StorefrontShell>,
    );

    expect(screen.getByRole("link", { name: /Cart - 3 items/i })).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders footer with shop info link and copyright in French", () => {
    mockPathname = "/fr";
    render(
      <StorefrontShell locale="fr" dict={frDictionary.storefront} cartCount={1}>
        <div>Contenu Catalogue</div>
      </StorefrontShell>,
    );

    expect(screen.getByRole("contentinfo")).toBeDefined();
    expect(screen.getByRole("link", { name: frDictionary.storefront.shopInfo })).toBeDefined();
    expect(screen.queryByRole("link", { name: frDictionary.storefront.terms })).toBeNull();
    expect(screen.queryByRole("link", { name: frDictionary.storefront.privacy })).toBeNull();
  });

  it("renders business name and explicit [ EN | FR ] toggle in header", () => {
    render(
      <StorefrontShell
        locale="en"
        dict={enDictionary.storefront}
        businessName="La Petite Boulangerie"
        cartCount={0}
      >
        <div>Content</div>
      </StorefrontShell>,
    );

    expect(screen.getAllByText("La Petite Boulangerie").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("EN")).toBeDefined();
    expect(screen.getByText("FR")).toBeDefined();
  });

  it("dynamically updates header cart badge from CartContext when cartCount is not provided", () => {
    render(
      <StorefrontShell
        locale="en"
        dict={enDictionary.storefront}
        businessName="La Petite Boulangerie"
      >
        <AddItemTestButton />
      </StorefrontShell>,
    );

    // Initial state: 0 items, no cart count badge
    expect(screen.queryByTestId("header-cart-badge")).toBeNull();

    // Click to add item to cart
    fireEvent.click(screen.getByRole("button", { name: "Add Baguette" }));

    // Header badge now shows count "1"
    const badge = screen.getByTestId("header-cart-badge");
    expect(badge).toBeDefined();
    expect(badge.textContent).toBe("1");
  });

  it.each([
    ["/en", "search"],
    ["/en/p/prod-1", "cart"],
    ["/en/order/tk-1", "cart"],
    ["/en/track", "cart"],
    ["/en/info", "share"],
    ["/en/cart", null],
    ["/en/checkout", null],
    ["/en/order/tk-1/confirmed", null],
  ])("shows the right header action on %s (#229)", (path, action) => {
    mockPathname = path;
    render(
      <StorefrontShell locale="en" dict={enDictionary.storefront} businessName="La Boulangerie">
        <div>Content</div>
      </StorefrontShell>,
    );
    expect(screen.queryByTestId("catalog-search-launcher") !== null).toBe(action === "search");
    expect(screen.queryByTestId("header-cart-link") !== null).toBe(action === "cart");
    expect(screen.queryByRole("button", { name: enDictionary.storefront.share }) !== null).toBe(
      action === "share",
    );
  });

  it("never links the business name (#229)", () => {
    mockPathname = "/en/cart";
    render(
      <StorefrontShell locale="en" dict={enDictionary.storefront} businessName="La Boulangerie">
        <div>Content</div>
      </StorefrontShell>,
    );
    const brand = screen.getByTestId("header-brand");
    expect(brand.closest("a")).toBeNull();
    expect(brand.textContent).toContain("La Boulangerie");
  });

  it.each([
    ["/en", true],
    ["/en/cart", true],
    ["/en/checkout", true],
    ["/en/order/tk-1/confirmed", true],
    ["/en/p/prod-1", false],
    ["/en/info", false],
  ])("shows the menu button on %s: %s (#231)", (path, hasMenu) => {
    mockPathname = path;
    render(
      <StorefrontShell locale="en" dict={enDictionary.storefront} businessName="La Boulangerie">
        <div>Content</div>
      </StorefrontShell>,
    );
    expect(screen.queryByTestId("storefront-menu-button") !== null).toBe(hasMenu);
  });
});
