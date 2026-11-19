import { describe, expect, it } from "vitest";
import { getDictionary } from "@/domain/i18n";
import { demoBusiness, demoSettings } from "@/lib/repositories/mock/fixtures/business";
import { demoProducts } from "@/lib/repositories/mock/fixtures/products";
import { toStorefrontBusiness } from "@/domain/storefront-business";
import { toStorefrontProduct } from "@/domain/storefront-product";
import {
  buildProductOgContent,
  buildProductPageMetadata,
  buildShopOgContent,
  buildStorefrontPageSocialMetadata,
  buildStorefrontRootMetadata,
  isAllowedOgDataUrl,
  isAllowedRemoteOgImageUrl,
  parseLocalPublicImagePath,
  resolveStorefrontLocale,
  storefrontAlternates,
  toMetaDescription,
  truncateOgText,
} from "../metadata";

describe("storefront metadata helpers", () => {
  it("resolves supported locales and falls back to English", () => {
    expect(resolveStorefrontLocale("en")).toBe("en");
    expect(resolveStorefrontLocale("fr")).toBe("fr");
    expect(resolveStorefrontLocale("de")).toBe("en");
  });

  it("uses the business name as default and single suffix, with Open Graph and Twitter card", () => {
    const meta = buildStorefrontRootMetadata({
      businessName: "Chez Awa",
      description: "Fresh daily menu",
      locale: "fr",
    });
    expect(meta.title).toEqual({ default: "Chez Awa", template: "%s · Chez Awa" });
    const template = (meta.title as { template: string }).template;
    expect(template.split("Chez Awa")).toHaveLength(2);
    expect(template.replace("%s", "Menu")).toBe("Menu · Chez Awa");
    expect(meta.openGraph).toEqual({
      title: "Chez Awa",
      description: "Fresh daily menu",
      siteName: "Chez Awa",
      locale: "fr",
      type: "website",
    });
    expect(meta.twitter).toEqual({
      card: "summary_large_image",
      title: "Chez Awa",
      description: "Fresh daily menu",
    });
  });

  it("builds child page social metadata preserving siteName and locale", () => {
    expect(
      buildStorefrontPageSocialMetadata({
        title: "Infos Boutique",
        description: "Horaires et adresse",
        businessName: "Chez Awa",
        locale: "fr",
      }),
    ).toEqual({
      openGraph: {
        title: "Infos Boutique",
        description: "Horaires et adresse",
        siteName: "Chez Awa",
        locale: "fr",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: "Infos Boutique",
        description: "Horaires et adresse",
      },
    });
  });

  it("builds product page metadata for found products (with and without description) and unknown products", () => {
    const sample = {
      product: toStorefrontProduct(demoProducts[0]),
      categoryName: "Breads",
      business: toStorefrontBusiness(demoBusiness),
      settings: demoSettings,
      isAcceptingOrders: true,
      isOpen: true,
    };

    const foundEn = buildProductPageMetadata({
      locale: "en",
      id: sample.product.id,
      productData: sample,
    });
    expect(foundEn.title).toBe(sample.product.name);
    expect(foundEn.description).toBe(sample.product.description);
    expect(foundEn.alternates).toEqual(storefrontAlternates("en", `/p/${sample.product.id}`));
    expect(foundEn.openGraph).toMatchObject({
      title: sample.product.name,
      siteName: demoBusiness.name,
      locale: "en",
    });

    const noDescFr = buildProductPageMetadata({
      locale: "fr",
      id: sample.product.id,
      productData: { ...sample, product: { ...sample.product, description: null } },
    });
    expect(noDescFr.description).toBe(`Commandez en ligne chez ${demoBusiness.name}.`);

    const missingFr = buildProductPageMetadata({
      locale: "fr",
      id: "unknown",
      productData: null,
    });
    expect(missingFr).toEqual({
      title: getDictionary("fr").storefront.notFoundTitle,
      description: getDictionary("fr").storefront.productNotFound,
      robots: { index: false },
    });
  });

  it("builds canonical and hreflang alternates for each locale", () => {
    expect(storefrontAlternates("fr", "/info")).toEqual({
      canonical: "/fr/info",
      languages: { en: "/en/info", fr: "/fr/info", "x-default": "/en/info" },
    });
    expect(storefrontAlternates("en").canonical).toBe("/en");
  });

  it("normalises and truncates descriptions and OG text", () => {
    expect(toMetaDescription("  a \n b  ", "fb")).toBe("a b");
    expect(toMetaDescription(null, "fb")).toBe("fb");
    expect(toMetaDescription("x".repeat(300), "fb")).toHaveLength(160);
    expect(truncateOgText("  hello \n world  ", 20)).toBe("hello world");
    expect(truncateOgText("x".repeat(30), 10)).toBe(`${"x".repeat(9)}…`);
    expect(truncateOgText(undefined, 10)).toBe("");
  });

  it("builds translated shop and product OG card content", () => {
    const shopEn = buildShopOgContent({
      businessName: "La Petite Boulangerie",
      description: null,
      address: "12 Rue de la Roquette, Paris",
      locale: "en",
    });
    expect(shopEn.badge).toBe(getDictionary("en").storefront.ogShopBadge);
    expect(shopEn.description).toBe("Order online from La Petite Boulangerie.");
    expect(shopEn.footer).toContain("12 Rue de la Roquette, Paris");
    expect(shopEn.monogram).toBe("L");

    const shopFr = buildShopOgContent({
      businessName: "La Petite Boulangerie",
      description: "Boulangerie artisanale",
      address: null,
      locale: "fr",
    });
    expect(shopFr.badge).toBe(getDictionary("fr").storefront.ogShopBadge);
    expect(shopFr.footer).toBe(getDictionary("fr").storefront.ogShopFooter);

    const prodFr = buildProductOgContent({
      productName: "Baguette Tradition",
      productDescription: "Croûte dorée",
      priceCents: 130,
      categoryName: null,
      businessName: "La Petite Boulangerie",
      locale: "fr",
    });
    expect(prodFr.badge).toBe(getDictionary("fr").storefront.ogProductBadge);
    expect(prodFr.price.replace(/\s/g, " ")).toBe("1,30 €");
    expect(prodFr.footer).toBe("Commander en ligne chez La Petite Boulangerie");

    const prodEn = buildProductOgContent({
      productName: "Traditional Baguette",
      productDescription: null,
      priceCents: 130,
      categoryName: "Breads",
      businessName: "La Petite Boulangerie",
      locale: "en",
    });
    expect(prodEn.badge).toBe("Breads");
    expect(prodEn.price).toBe("€1.30");
    expect(prodEn.footer).toBe("Order online from La Petite Boulangerie");
  });

  it("validates local public paths, data URLs and Supabase remote URLs safely", () => {
    expect(parseLocalPublicImagePath("/images/baguette.jpg")).toEqual({
      relativePath: "images/baguette.jpg",
      mimeType: "image/jpeg",
    });
    expect(parseLocalPublicImagePath("/images/cake.png?v=1")).toEqual({
      relativePath: "images/cake.png",
      mimeType: "image/png",
    });
    expect(parseLocalPublicImagePath("/../secret.jpg")).toBeNull();
    expect(parseLocalPublicImagePath("//evil.com/a.jpg")).toBeNull();
    expect(parseLocalPublicImagePath("/images/a\\b.jpg")).toBeNull();
    expect(parseLocalPublicImagePath("/icons/icon.svg")).toBeNull();
    expect(parseLocalPublicImagePath("/images/noext")).toBeNull();

    expect(isAllowedOgDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isAllowedOgDataUrl("data:image/avif;base64,AAAA")).toBe(false);
    expect(isAllowedOgDataUrl("data:text/html;base64,PGh0bWw+")).toBe(false);

    const supabaseUrl = "https://abc.supabase.co";
    expect(
      isAllowedRemoteOgImageUrl(
        "https://abc.supabase.co/storage/v1/object/public/product-images/biz/photo.jpg",
        supabaseUrl,
      ),
    ).toBe(true);
    expect(
      isAllowedRemoteOgImageUrl(
        "https://abc.supabase.co/storage/v1/object/public/other-bucket/photo.jpg",
        supabaseUrl,
      ),
    ).toBe(false);
    expect(
      isAllowedRemoteOgImageUrl(
        "https://evil.example/storage/v1/object/public/product-images/biz/photo.jpg",
        supabaseUrl,
      ),
    ).toBe(false);
    expect(isAllowedRemoteOgImageUrl("https://abc.supabase.co/a.jpg", undefined)).toBe(false);
    expect(isAllowedRemoteOgImageUrl("not-a-url", supabaseUrl)).toBe(false);
  });
});
