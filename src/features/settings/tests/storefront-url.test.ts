import { afterEach, describe, expect, it, vi } from "vitest";
import { buildStorefrontUrl } from "../storefront-url";
import { DEFAULT_LOCALE } from "@/domain/i18n";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildStorefrontUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL when set and strips protocol for displayUrl", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");

    const result = buildStorefrontUrl({
      locale: "fr",
      fallbackOrigin: "http://localhost:3000",
    });

    expect(result).toEqual({
      fullUrl: "https://shop.example.com/fr",
      displayUrl: "shop.example.com/fr",
    });
  });

  it("strips trailing slashes from NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com/");

    const result = buildStorefrontUrl({
      locale: "en",
      fallbackOrigin: "http://localhost:3000",
    });

    expect(result).toEqual({
      fullUrl: "https://shop.example.com/en",
      displayUrl: "shop.example.com/en",
    });
  });

  it("falls back to fallbackOrigin when NEXT_PUBLIC_SITE_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    const result = buildStorefrontUrl({
      locale: "en",
      fallbackOrigin: "http://localhost:3000",
    });

    expect(result).toEqual({
      fullUrl: "http://localhost:3000/en",
      displayUrl: "localhost:3000/en",
    });
  });

  it("strips trailing slashes from fallbackOrigin when NEXT_PUBLIC_SITE_URL is invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-valid-url");

    const result = buildStorefrontUrl({
      locale: "fr",
      fallbackOrigin: "https://preview.example.com/",
    });

    expect(result).toEqual({
      fullUrl: "https://preview.example.com/fr",
      displayUrl: "preview.example.com/fr",
    });
  });

  it("returns null when both NEXT_PUBLIC_SITE_URL and fallbackOrigin are unavailable", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");

    expect(buildStorefrontUrl({ locale: "en", fallbackOrigin: "" })).toBeNull();
    expect(buildStorefrontUrl({ locale: "en" })).toBeNull();
  });

  it("falls back to DEFAULT_LOCALE when locale is unsupported or omitted", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");

    expect(buildStorefrontUrl({ locale: "es" })).toEqual({
      fullUrl: `https://shop.example.com/${DEFAULT_LOCALE}`,
      displayUrl: `shop.example.com/${DEFAULT_LOCALE}`,
    });
    expect(buildStorefrontUrl({})).toEqual({
      fullUrl: `https://shop.example.com/${DEFAULT_LOCALE}`,
      displayUrl: `shop.example.com/${DEFAULT_LOCALE}`,
    });
  });
});
