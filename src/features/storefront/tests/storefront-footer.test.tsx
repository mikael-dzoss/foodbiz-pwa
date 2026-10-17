import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorefrontFooter } from "../components/storefront-footer";
import { enDictionary } from "@/domain/i18n";

let mockPathname = "/en";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("StorefrontFooter", () => {
  afterEach(() => {
    cleanup();
    mockPathname = "/en";
  });

  it("renders footer links and copyright on catalog / home page", () => {
    mockPathname = "/en";
    render(
      <StorefrontFooter
        locale="en"
        dict={enDictionary.storefront}
        businessName="La Petite Boulangerie"
      />,
    );

    expect(screen.getByRole("contentinfo")).toBeDefined();
    expect(screen.getByRole("link", { name: enDictionary.storefront.contact })).toBeDefined();
    expect(screen.getByRole("link", { name: enDictionary.storefront.terms })).toBeDefined();
    expect(screen.getByRole("link", { name: enDictionary.storefront.privacy })).toBeDefined();
    expect(screen.getByText(/La Petite Boulangerie/)).toBeDefined();
  });

  it("returns null and hides footer on shop info page", () => {
    mockPathname = "/en/info";
    const { container } = render(
      <StorefrontFooter
        locale="en"
        dict={enDictionary.storefront}
        businessName="La Petite Boulangerie"
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("returns null and hides footer on product detail view", () => {
    mockPathname = "/en/p/prod-baguette-1";
    const { container } = render(
      <StorefrontFooter
        locale="en"
        dict={enDictionary.storefront}
        businessName="La Petite Boulangerie"
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("returns null and hides footer on localized product detail view", () => {
    mockPathname = "/fr/p/croissant-123";
    const { container } = render(
      <StorefrontFooter
        locale="fr"
        dict={enDictionary.storefront}
        businessName="La Petite Boulangerie"
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });
});
