import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StorefrontShell } from "../components/storefront-shell";
import { useCart, resetCartStore } from "../context/cart-context";
import { enDictionary, frDictionary } from "@/domain/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
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
});

afterEach(() => {
  cleanup();
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
      screen.getByRole("link", { name: enDictionary.storefront.switchLanguage }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: /Cart \(0 items\)/i })).toBeDefined();
  });

  it("displays badge with item count when cartCount > 0", () => {
    render(
      <StorefrontShell locale="en" dict={enDictionary.storefront} cartCount={3}>
        <div>Catalog Content</div>
      </StorefrontShell>,
    );

    expect(screen.getByRole("link", { name: /Cart \(3 items\)/i })).toBeDefined();
    expect(screen.getByText("3")).toBeDefined();
  });

  it("renders footer with legal and contact links in French", () => {
    render(
      <StorefrontShell locale="fr" dict={frDictionary.storefront} cartCount={1}>
        <div>Contenu Catalogue</div>
      </StorefrontShell>,
    );

    expect(screen.getByRole("contentinfo")).toBeDefined();
    expect(screen.getByRole("link", { name: frDictionary.storefront.contact })).toBeDefined();
    expect(screen.getByRole("link", { name: frDictionary.storefront.terms })).toBeDefined();
    expect(screen.getByRole("link", { name: frDictionary.storefront.privacy })).toBeDefined();
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

    expect(screen.getByText("La Petite Boulangerie")).toBeDefined();
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
});
