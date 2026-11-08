import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorefrontFooter } from "../components/storefront-footer";
import { enDictionary, frDictionary } from "@/domain/i18n";
import type { Business } from "@/domain/business";

let mockPathname = "/en";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

const fullBusiness: Business = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "La Petite Boulangerie",
  slug: "la-petite-boulangerie",
  currency: "EUR",
  description: "Artisanal organic sourdough bakery and French pastries in Paris.",
  phone: "+33 1 43 55 67 89",
  email: "bonjour@lapetiteboulangerie.fr",
  whatsappNumber: "+33 6 12 34 56 78",
  instagramUrl: "https://instagram.com/lapetiteboulangerie",
  facebookUrl: "https://facebook.com/lapetiteboulangerie",
  tiktokUrl: "https://tiktok.com/@lapetiteboulangerie",
  address: "12 Rue de la Roquette, 75011 Paris",
  logoUrl: "/images/croissant.jpg",
  createdAt: "2026-08-01T08:00:00.000Z",
  updatedAt: "2026-08-01T08:00:00.000Z",
};

describe("StorefrontFooter (#201)", () => {
  afterEach(() => {
    mockPathname = "/en";
    vi.useRealTimers();
  });

  it("renders all configured Row 1 and Row 2 fields when business data is complete", () => {
    mockPathname = "/en";
    render(
      <StorefrontFooter
        locale="en"
        dict={enDictionary.storefront}
        business={fullBusiness}
        currentYear={2027}
      />,
    );

    expect(screen.getByRole("contentinfo")).toBeDefined();

    // Row 1: Logo, name, description
    const logo = screen.getByTestId("footer-business-logo");
    expect(logo.getAttribute("src")).toContain("croissant.jpg");
    expect(logo.getAttribute("alt")).toBe("La Petite Boulangerie");
    expect(screen.getByTestId("footer-business-name").textContent).toBe("La Petite Boulangerie");
    expect(screen.getByTestId("footer-business-description").textContent).toBe(
      "Artisanal organic sourdough bakery and French pastries in Paris.",
    );

    // Row 1: no repeated contact details; links to each shop info section (#233)
    expect(screen.queryByTestId("footer-phone-link")).toBeNull();
    expect(screen.queryByText("+33 1 43 55 67 89")).toBeNull();
    expect(screen.queryByText("12 Rue de la Roquette, 75011 Paris, France")).toBeNull();
    const sectionLinks = screen.getByTestId("footer-section-links").querySelectorAll("a");
    expect(Array.from(sectionLinks, (a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Shop information", "/en/info#overview"],
      ["Contact us", "/en/info#contact"],
      ["Opening hours", "/en/info#hours"],
      ["Location & address", "/en/info#location"],
      ["Delivery & ordering policy", "/en/info#ordering-policy"],
    ]);

    // Row 2: Social links with accessible labels and target="_blank"
    const igLink = screen.getByRole("link", { name: "La Petite Boulangerie on Instagram" });
    expect(igLink.getAttribute("href")).toBe("https://instagram.com/lapetiteboulangerie");
    expect(igLink.getAttribute("target")).toBe("_blank");
    expect(igLink.getAttribute("rel")).toBe("noopener noreferrer");

    const fbLink = screen.getByRole("link", { name: "La Petite Boulangerie on Facebook" });
    expect(fbLink.getAttribute("href")).toBe("https://facebook.com/lapetiteboulangerie");

    const ttLink = screen.getByRole("link", { name: "La Petite Boulangerie on TikTok" });
    expect(ttLink.getAttribute("href")).toBe("https://tiktok.com/@lapetiteboulangerie");

    // Row 2: Legal links hidden by default (LEGAL_PAGES_AVAILABLE = false)
    expect(screen.queryByTestId("footer-legal-links")).toBeNull();
    expect(screen.queryByRole("link", { name: enDictionary.storefront.privacy })).toBeNull();
    expect(screen.queryByRole("link", { name: enDictionary.storefront.terms })).toBeNull();

    // Row 2: Copyright
    expect(screen.getByTestId("footer-copyright").textContent).toBe("© 2027 La Petite Boulangerie");
  });

  it("falls back to app icon and hides missing contact/social fields when unconfigured", () => {
    const minimalBusiness: Business = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Boulangerie Minimale",
      slug: "boulangerie-minimale",
      currency: "EUR",
      logoUrl: null,
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T08:00:00.000Z",
    };

    render(
      <StorefrontFooter locale="fr" dict={frDictionary.storefront} business={minimalBusiness} />,
    );

    // Fallback icon from public/icons
    const logo = screen.getByTestId("footer-business-logo");
    expect(logo.getAttribute("src")).toBe("/icons/icon.svg");

    // Optional fields omitted
    expect(screen.queryByTestId("footer-business-description")).toBeNull();
    expect(screen.queryByTestId("footer-phone-link")).toBeNull();
    expect(screen.queryByTestId("footer-email-link")).toBeNull();
    expect(screen.queryByTestId("footer-whatsapp-link")).toBeNull();
    expect(screen.queryByTestId("footer-address")).toBeNull();
    expect(screen.queryByTestId("footer-social-links")).toBeNull();

    // Section links still present in FR
    const overviewLink = screen.getByTestId("footer-link-overview");
    expect(overviewLink.getAttribute("href")).toBe("/fr/info#overview");
    expect(overviewLink.textContent).toBe(frDictionary.storefront.footerShopInformation);
  });

  it("computes dynamic copyright year and localizes social labels in French", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2029-06-15T12:00:00.000Z"));

    const partialSocialBusiness: Business = {
      ...fullBusiness,
      logoUrl: "https://cdn.example.com/logo.png",
      facebookUrl: "",
      tiktokUrl: undefined,
    };

    render(
      <StorefrontFooter
        locale="fr"
        dict={frDictionary.storefront}
        business={partialSocialBusiness}
        legalPagesAvailable
      />,
    );

    expect(screen.getByRole("link", { name: "La Petite Boulangerie sur Instagram" })).toBeDefined();
    expect(screen.queryByTestId("footer-social-facebook")).toBeNull();
    expect(screen.queryByTestId("footer-social-tiktok")).toBeNull();

    // Legal links rendered when flag is enabled
    expect(screen.getByRole("link", { name: frDictionary.storefront.privacy })).toBeDefined();
    expect(screen.getByRole("link", { name: frDictionary.storefront.terms })).toBeDefined();

    // Dynamic year from system clock
    expect(screen.getByTestId("footer-copyright").textContent).toBe("© 2029 La Petite Boulangerie");
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
