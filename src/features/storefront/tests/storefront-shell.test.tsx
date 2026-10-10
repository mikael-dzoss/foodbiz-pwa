import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorefrontShell } from "../components/storefront-shell";
import { enDictionary, frDictionary } from "@/domain/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en",
}));

afterEach(() => {
  cleanup();
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
});
