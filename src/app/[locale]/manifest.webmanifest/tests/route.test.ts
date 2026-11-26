// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_METADATA } from "@/config/app";
import { getDictionary, interpolate, SUPPORTED_LOCALES } from "@/domain/i18n";
import * as catalogData from "@/features/storefront/catalog-data";
import { demoBusiness } from "@/lib/repositories/mock/fixtures/business";
import { GET as getManagerManifest } from "@/app/manage/manifest.webmanifest/route";
import { generateStaticParams, GET } from "../route";

describe("GET /[locale]/manifest.webmanifest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates static params for all supported locales", () => {
    expect(generateStaticParams()).toEqual(SUPPORTED_LOCALES.map((locale) => ({ locale })));
  });

  it.each(SUPPORTED_LOCALES)(
    "returns 200 with storefront manifest JSON for locale %s",
    async (locale) => {
      const response = await GET(new Request(`http://localhost/${locale}/manifest.webmanifest`), {
        params: Promise.resolve({ locale }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/manifest+json");

      const body = (await response.json()) as MetadataRoute.Manifest;
      expect(body.id).toBe("/");
      expect(body.scope).toBe("/");
      expect(body.start_url).toBe(`/${locale}`);
      expect(body.lang).toBe(locale);
      expect(body.dir).toBe("ltr");
      expect(body.name).toBe(demoBusiness.name);
      expect(body.short_name).toBe(demoBusiness.name);
      expect(body.description).toBe(demoBusiness.description);
      expect(body.display).toBe("standalone");
      expect(body.orientation).toBe("portrait");
      expect(body.background_color).toBe(APP_METADATA.backgroundColor);
      expect(body.theme_color).toBe(APP_METADATA.themeColor);

      const icons = body.icons ?? [];
      expect(icons).toEqual(APP_METADATA.icons);
      for (const icon of icons) {
        expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
      }
    },
  );

  it("has a distinct app id and scope from the manager manifest so both can coexist", async () => {
    const storefrontRes = await GET(new Request("http://localhost/en/manifest.webmanifest"), {
      params: Promise.resolve({ locale: "en" }),
    });
    const storefront = (await storefrontRes.json()) as MetadataRoute.Manifest;
    const manager = (await getManagerManifest().json()) as MetadataRoute.Manifest;

    expect(storefront.id).not.toBe(manager.id);
    expect(storefront.id).toBe("/");
    expect(manager.id).toBe("/manage");
    expect(storefront.scope).toBe("/");
    expect(manager.scope).toBe("/manage/");
    expect(storefront.start_url).toBe("/en");
    expect(manager.start_url).toBe("/manage");
  });

  it("falls back to a localized description when the shop has no description", async () => {
    const baseCatalog = await catalogData.getStorefrontCatalog();
    for (const locale of SUPPORTED_LOCALES) {
      vi.spyOn(catalogData, "getStorefrontCatalog").mockResolvedValueOnce({
        ...baseCatalog,
        business: { ...baseCatalog.business, description: "   " },
      });

      const response = await GET(new Request(`http://localhost/${locale}/manifest.webmanifest`), {
        params: Promise.resolve({ locale }),
      });
      const body = (await response.json()) as MetadataRoute.Manifest;
      expect(body.description).toBe(
        interpolate(getDictionary(locale).storefront.metaDescription, {
          business: baseCatalog.business.name,
        }),
      );
    }
  });

  it.each(["de", "xx", "EN", "en-US"])("returns 404 for unknown locale %s", async (locale) => {
    const catalogSpy = vi.spyOn(catalogData, "getStorefrontCatalog");
    const response = await GET(new Request(`http://localhost/${locale}/manifest.webmanifest`), {
      params: Promise.resolve({ locale }),
    });

    expect(response.status).toBe(404);
    expect(catalogSpy).not.toHaveBeenCalled();
  });
});
