import { describe, expect, it } from "vitest";
import { buildStorefrontRootMetadata, storefrontAlternates, toMetaDescription } from "../metadata";

describe("storefront metadata helpers", () => {
  it("uses the business name as default and single suffix", () => {
    const meta = buildStorefrontRootMetadata({
      businessName: "Chez Awa",
      description: "d",
      locale: "fr",
    });
    expect(meta.title).toEqual({ default: "Chez Awa", template: "%s · Chez Awa" });
    const template = (meta.title as { template: string }).template;
    expect(template.split("Chez Awa")).toHaveLength(2);
    expect(template.replace("%s", "Menu")).toBe("Menu · Chez Awa");
  });

  it("builds canonical and hreflang alternates for each locale", () => {
    expect(storefrontAlternates("fr", "/info")).toEqual({
      canonical: "/fr/info",
      languages: { en: "/en/info", fr: "/fr/info", "x-default": "/en/info" },
    });
    expect(storefrontAlternates("en").canonical).toBe("/en");
  });

  it("normalises and truncates descriptions, with a fallback", () => {
    expect(toMetaDescription("  a \n b  ", "fb")).toBe("a b");
    expect(toMetaDescription(null, "fb")).toBe("fb");
    expect(toMetaDescription("x".repeat(300), "fb")).toHaveLength(160);
  });
});
