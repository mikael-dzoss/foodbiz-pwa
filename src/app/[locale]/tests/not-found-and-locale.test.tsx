import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary, isSupportedLocale } from "@/domain/i18n";
import LocaleNotFound from "../not-found";

let mockParams: { locale?: string } = { locale: "fr" };
vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

vi.mock("@/features/storefront", () => ({
  getStorefrontCatalog: vi.fn(),
  StorefrontShell: () => null,
}));

describe("storefront not-found", () => {
  beforeEach(() => {
    mockParams = { locale: "fr" };
  });

  it("is localized and links back to the locale home", () => {
    render(<LocaleNotFound />);
    const fr = getDictionary("fr").storefront;
    expect(screen.getByTestId("storefront-not-found").textContent).toContain(fr.notFoundTitle);
    expect(screen.getByTestId("storefront-not-found-home").getAttribute("href")).toBe("/fr");
  });

  it("falls back to English for an unknown locale segment", () => {
    mockParams = { locale: "xx" };
    render(<LocaleNotFound />);
    expect(screen.getByTestId("storefront-not-found").textContent).toContain(
      getDictionary("en").storefront.notFoundTitle,
    );
  });
});

describe("locale validation", () => {
  it("accepts supported locales and rejects everything else", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(true);
    for (const value of ["de", "xx", "", "EN", "en-US"])
      expect(isSupportedLocale(value)).toBe(false);
  });

  it("the locale layout calls notFound() for an unknown locale", async () => {
    const { default: LocaleLayout } = await import("../layout");
    await expect(
      LocaleLayout({ children: null, params: Promise.resolve({ locale: "de" }) }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
