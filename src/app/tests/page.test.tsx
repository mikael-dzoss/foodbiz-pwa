import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocaleHomePage from "../[locale]/page";
import ProductDetailPage from "../[locale]/p/[id]/page";
import ShopInfoPage from "../[locale]/info/page";
import RootPage from "../page";
import { CartProvider } from "@/features/storefront";

afterEach(() => {
  cleanup();
});

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

    // Heading and search should be present
    expect(screen.getByPlaceholderText(/Search products/i)).toBeDefined();
    // Category tabs
    expect(screen.getByRole("button", { name: /All/i })).toBeDefined();
  });

  it("LocaleHomePage renders French catalog with French search placeholder", async () => {
    const page = await LocaleHomePage({ params: Promise.resolve({ locale: "fr" }) });
    render(<CartProvider>{page}</CartProvider>);

    expect(screen.getByPlaceholderText(/Rechercher un produit/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Tous/i })).toBeDefined();
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
});
