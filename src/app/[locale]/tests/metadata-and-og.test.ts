// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-sans" }),
}));
import { getDictionary, interpolate } from "@/domain/i18n";
import { storefrontAlternates } from "@/features/storefront/metadata";
import * as catalogData from "@/features/storefront/catalog-data";
import * as ogImage from "@/features/storefront/og-image";
import { demoBusiness } from "@/lib/repositories/mock/fixtures/business";
import { demoProducts } from "@/lib/repositories/mock/fixtures/products";
import { generateMetadata as layoutMetadata } from "../layout";
import { generateMetadata as homeMetadata } from "../page";
import { generateMetadata as infoMetadata } from "../info/page";
import { generateMetadata as productMetadata } from "../p/[id]/page";
import { generateMetadata as cartMetadata } from "../cart/page";
import { generateMetadata as checkoutMetadata } from "../checkout/page";
import { generateMetadata as trackMetadata } from "../track/page";
import { generateMetadata as orderTrackingMetadata } from "../order/[token]/page";
import { generateMetadata as orderConfirmedMetadata } from "../order/[token]/confirmed/page";
import ShopOpenGraphImage, {
  contentType as shopOgContentType,
  size as shopOgSize,
} from "../opengraph-image";
import ProductOpenGraphImage, {
  contentType as productOgContentType,
  size as productOgSize,
} from "../p/[id]/opengraph-image";

const PNG_MAGIC = "89504e470d0a1a0a";
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function expectPngResponse(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  const buffer = Buffer.from(await response.arrayBuffer());
  expect(buffer.subarray(0, 8).toString("hex")).toBe(PNG_MAGIC);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storefront page metadata (EN & FR)", () => {
  it("builds root layout and home metadata with alternates and Open Graph fields", async () => {
    for (const locale of ["en", "fr"] as const) {
      const root = await layoutMetadata({
        children: null,
        params: Promise.resolve({ locale }),
      });
      expect(root.title).toEqual({
        default: demoBusiness.name,
        template: `%s · ${demoBusiness.name}`,
      });
      expect(root.description).toBe(demoBusiness.description);
      expect(root.openGraph).toMatchObject({
        siteName: demoBusiness.name,
        title: demoBusiness.name,
        locale,
        type: "website",
      });

      const home = await homeMetadata({ params: Promise.resolve({ locale }) });
      expect(home.alternates).toEqual(storefrontAlternates(locale));
    }
  });

  it("translates shop info metadata and preserves alternates and Open Graph fields", async () => {
    for (const locale of ["en", "fr"] as const) {
      const dict = getDictionary(locale).storefront;
      const meta = await infoMetadata({ params: Promise.resolve({ locale }) });
      expect(meta.title).toBe(dict.shopInfo);
      expect(meta.description).toBe(
        interpolate(dict.metaInfoDescription, { business: demoBusiness.name }),
      );
      expect(meta.alternates).toEqual(storefrontAlternates(locale, "/info"));
      expect(meta.openGraph).toMatchObject({
        title: dict.shopInfo,
        siteName: demoBusiness.name,
        locale,
      });
    }
  });

  it("builds product metadata for visible products and falls back cleanly for unknown products", async () => {
    const product = demoProducts[0];
    for (const locale of ["en", "fr"] as const) {
      const found = await productMetadata({
        params: Promise.resolve({ locale, id: product.id }),
      });
      expect(found.title).toBe(product.name);
      expect(found.description).toBe(product.description);
      expect(found.alternates).toEqual(storefrontAlternates(locale, `/p/${product.id}`));
      expect(found.openGraph).toMatchObject({
        title: product.name,
        siteName: demoBusiness.name,
        locale,
      });

      const dict = getDictionary(locale).storefront;
      const missing = await productMetadata({
        params: Promise.resolve({ locale, id: "does-not-exist" }),
      });
      expect(missing.title).toBe(dict.notFoundTitle);
      expect(missing.description).toBe(dict.productNotFound);
      expect(missing.robots).toEqual({ index: false });
    }
  });

  it("keeps private storefront routes noindex with translated generic metadata", async () => {
    for (const locale of ["en", "fr"] as const) {
      const dict = getDictionary(locale);

      const cart = await cartMetadata({ params: Promise.resolve({ locale }) });
      expect(cart.title).toBe(dict.storefront.yourCart);
      expect(cart.description).toBe(dict.storefront.metaCartDescription);
      expect(cart.robots).toEqual({ index: false });
      expect(cart.alternates).toEqual(storefrontAlternates(locale, "/cart"));

      const checkout = await checkoutMetadata({ params: Promise.resolve({ locale }) });
      expect(checkout.title).toBe(dict.storefront.checkoutTitle);
      expect(checkout.description).toBe(dict.storefront.metaCheckoutDescription);
      expect(checkout.robots).toEqual({ index: false });
      expect(checkout.alternates).toEqual(storefrontAlternates(locale, "/checkout"));

      const track = await trackMetadata({ params: Promise.resolve({ locale }) });
      expect(track.title).toBe(dict.storefront.trackTitle);
      expect(track.description).toBe(dict.storefront.metaTrackDescription);
      expect(track.robots).toEqual({ index: false });
      expect(track.alternates).toEqual(storefrontAlternates(locale, "/track"));

      const tracking = await orderTrackingMetadata({
        params: Promise.resolve({ locale, token: "secret-token-123" }),
      });
      expect(tracking.title).toBe(dict.orderTracking.title);
      expect(tracking.description).toBe(dict.storefront.metaOrderTrackingDescription);
      expect(tracking.robots).toEqual({ index: false, follow: false });
      expect(tracking.referrer).toBe("no-referrer");

      const confirmed = await orderConfirmedMetadata({
        params: Promise.resolve({ locale, token: "secret-token-123" }),
      });
      expect(confirmed.title).toBe(dict.orderConfirmation.title);
      expect(confirmed.description).toBe(dict.orderConfirmation.receivedHelp);
      expect(confirmed.robots).toEqual({ index: false, follow: false });
      expect(confirmed.referrer).toBe("no-referrer");
    }
  });
});

describe("storefront Open Graph image routes", () => {
  it("exports standard 1200x630 PNG config for shop and product OG routes", () => {
    expect(shopOgSize).toEqual({ width: 1200, height: 630 });
    expect(shopOgContentType).toBe("image/png");
    expect(productOgSize).toEqual({ width: 1200, height: 630 });
    expect(productOgContentType).toBe("image/png");
  });

  it("renders the shop OG image in English and French, and falls back if catalog fails", async () => {
    await expectPngResponse(
      await ShopOpenGraphImage({ params: Promise.resolve({ locale: "en" }) }),
    );
    await expectPngResponse(
      await ShopOpenGraphImage({ params: Promise.resolve({ locale: "fr" }) }),
    );

    vi.spyOn(catalogData, "getStorefrontCatalog").mockRejectedValueOnce(new Error("DB offline"));
    await expectPngResponse(
      await ShopOpenGraphImage({ params: Promise.resolve({ locale: "fr" }) }),
    );
  }, 15_000);

  it("renders product OG image with photo, without photo, and falls back cleanly for unknown products", async () => {
    const productWithPhoto = demoProducts[0];
    const resolveSpy = vi
      .spyOn(ogImage, "resolveOgImageSrc")
      .mockResolvedValueOnce(TINY_PNG_DATA_URL)
      .mockResolvedValueOnce(null);

    // Known product with photo
    await expectPngResponse(
      await ProductOpenGraphImage({
        params: Promise.resolve({ locale: "en", id: productWithPhoto.id }),
      }),
    );
    expect(resolveSpy).toHaveBeenCalledWith(productWithPhoto.imageUrl);

    // Known product when photo is absent/unreadable (FR)
    await expectPngResponse(
      await ProductOpenGraphImage({
        params: Promise.resolve({ locale: "fr", id: productWithPhoto.id }),
      }),
    );

    // Unknown product falls back to shop OG image without crashing
    await expectPngResponse(
      await ProductOpenGraphImage({
        params: Promise.resolve({ locale: "fr", id: "non-existent-product" }),
      }),
    );

    // Even if data access throws, route falls back to branded image without crashing
    vi.spyOn(catalogData, "getStorefrontProduct").mockRejectedValueOnce(new Error("DB offline"));
    await expectPngResponse(
      await ProductOpenGraphImage({
        params: Promise.resolve({ locale: "en", id: productWithPhoto.id }),
      }),
    );
  }, 15_000);
});
