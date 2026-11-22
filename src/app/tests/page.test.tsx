import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LocaleHomePage from "../[locale]/page";
import ProductDetailPage, {
  ensureStatic as productEnsureStatic,
  generateStaticParams as productStaticParams,
} from "../[locale]/p/[id]/page";
import ShopInfoPage from "../[locale]/info/page";
import { CartProvider } from "@/features/storefront";
import * as catalogData from "@/features/storefront/catalog-data";
import { DEMO_PRODUCT, demoProducts } from "@/lib/repositories/mock/fixtures/products";

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
  beforeEach(() => {
    notFoundMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    const fetchSpy = vi.spyOn(catalogData, "getStorefrontProduct");
    await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: "non-existent-product-id" }),
    });

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ProductDetailPage calls notFound() for an unknown or hidden product UUID", async () => {
    await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: "00000000-0000-0000-0000-000000000000" }),
    });
    expect(notFoundMock).toHaveBeenCalledTimes(1);

    // Hidden products return null from getStorefrontProduct (#81)
    vi.spyOn(catalogData, "getStorefrontProduct").mockResolvedValueOnce(null);
    await ProductDetailPage({
      params: Promise.resolve({ locale: "fr", id: demoProducts[0].id }),
    });
    expect(notFoundMock).toHaveBeenCalledTimes(2);
  });

  it("ProductDetailPage exports ensureStatic = 'navigation' and visible product static params (#303)", async () => {
    expect(productEnsureStatic).toBe("navigation");

    const params = await productStaticParams();
    expect(params).toEqual(demoProducts.map((p) => ({ id: p.id })));

    // Empty catalog falls back to a valid nil UUID placeholder for Cache Components
    const catalog = await catalogData.getStorefrontCatalog();
    vi.spyOn(catalogData, "getStorefrontCatalog").mockResolvedValueOnce({
      ...catalog,
      groupedCategories: [],
    });
    expect(await productStaticParams()).toEqual([{ id: "00000000-0000-0000-0000-000000000000" }]);
  });

  it("ProductDetailPage renders a dish with its optional Drinks add-on group", async () => {
    const page = await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: DEMO_PRODUCT.chaudChaudNoyaux.id }),
    });
    render(<CartProvider>{page}</CartProvider>);

    expect(
      screen.getByRole("heading", { level: 1, name: DEMO_PRODUCT.chaudChaudNoyaux.name }),
    ).toBeDefined();
    expect(screen.getByTestId("product-addons-group")).toBeDefined();
    expect(
      screen.getByRole("checkbox", { name: new RegExp(DEMO_PRODUCT.kossam.name, "i") }),
    ).toBeDefined();
  });

  it("ProductDetailPage renders a drink with Accompaniments and a snack with no add-on group (#207)", async () => {
    const drinkPage = await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: DEMO_PRODUCT.kossam.id }),
    });
    const { unmount } = render(<CartProvider>{drinkPage}</CartProvider>);

    expect(screen.getByRole("heading", { level: 1, name: DEMO_PRODUCT.kossam.name })).toBeDefined();
    expect(screen.getByText("Accompaniments")).toBeDefined();
    expect(
      screen.getByRole("checkbox", { name: new RegExp(DEMO_PRODUCT.beignetsMais.name, "i") }),
    ).toBeDefined();
    unmount();

    const snackPage = await ProductDetailPage({
      params: Promise.resolve({ locale: "en", id: DEMO_PRODUCT.beignetsMais.id }),
    });
    render(<CartProvider>{snackPage}</CartProvider>);

    expect(
      screen.getByRole("heading", { level: 1, name: DEMO_PRODUCT.beignetsMais.name }),
    ).toBeDefined();
    expect(screen.queryByTestId("product-addons-group")).toBeNull();
  });
});
