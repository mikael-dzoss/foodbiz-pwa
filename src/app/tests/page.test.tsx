import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocaleHomePage from "../[locale]/page";
import ProductDetailPage from "../[locale]/p/[id]/page";
import ShopInfoPage from "../[locale]/info/page";
import RootPage from "../page";
import { CartProvider } from "@/features/storefront";

const notFoundMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => notFoundMock(),
  usePathname: () => "/en",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

describe("Internationalized storefront pages", () => {
  it("RootPage redirects to default locale /en", async () => {
    const { redirect } = await import("next/navigation");
    RootPage();
    expect(redirect).toHaveBeenCalledWith("/en");
  });

  it("LocaleHomePage renders English catalog with search and categories", async () => {
    const page = await LocaleHomePage({ params: Promise.resolve({ locale: "en" }) });
    render(<CartProvider>{page}</CartProvider>);

    // Search launcher lives in the storefront header now (#229), not in the catalog
    expect(screen.queryByRole("button", { name: /Search the menu/i })).toBeNull();
    // Category section headings rendered
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
  });

  it("LocaleHomePage renders French catalog without an inline search launcher", async () => {
    const page = await LocaleHomePage({ params: Promise.resolve({ locale: "fr" }) });
    render(<CartProvider>{page}</CartProvider>);

    expect(screen.queryByRole("button", { name: /Rechercher dans le menu/i })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
  });

  it("generateStaticParams returns all supported locales", async () => {
    const { generateStaticParams } = await import("../[locale]/page");
    const params = await generateStaticParams();
    expect(params).toEqual([{ locale: "en" }, { locale: "fr" }]);
  });

  it("ShopInfoPage renders business details and hours", async () => {
    const page = await ShopInfoPage({ params: Promise.resolve({ locale: "en" }) });
    render(<CartProvider>{page}</CartProvider>);

    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(
      screen.getByRole("link", { name: /(Return to Catalog|Back to catalog)/i }),
    ).toBeDefined();
  });

  it("ProductDetailPage calls notFound() for invalid or non-existent product ID", async () => {
    await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: "non-existent-product-id" }),
    });

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("ProductDetailPage renders a dish with its optional Drinks add-on group", async () => {
    const page = await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: "33333333-3333-4333-8333-333333333301" }),
    });
    render(<CartProvider>{page}</CartProvider>);

    expect(screen.getByRole("heading", { level: 1, name: "Traditional Baguette" })).toBeDefined();
    expect(screen.getByTestId("product-addons-group")).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /Double Espresso/i })).toBeDefined();
  });

  it("ProductDetailPage renders a drink with Accompaniments and a snack with no add-on group (#207)", async () => {
    const drinkPage = await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: "33333333-3333-4333-8333-333333333313" }),
    });
    const { unmount } = render(<CartProvider>{drinkPage}</CartProvider>);

    expect(screen.getByRole("heading", { level: 1, name: "Double Espresso" })).toBeDefined();
    expect(screen.getByText("Accompaniments")).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /Madeleines x3/i })).toBeDefined();
    unmount();

    const snackPage = await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: "33333333-3333-4333-8333-333333333316" }),
    });
    render(<CartProvider>{snackPage}</CartProvider>);

    expect(screen.getByRole("heading", { level: 1, name: "Madeleines x3" })).toBeDefined();
    expect(screen.queryByTestId("product-addons-group")).toBeNull();
  });
});
