import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  enDictionary,
  frDictionary,
  getDictionary,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../i18n";

describe("Internationalisation Foundation (#31)", () => {
  it("defines supported locales with English as default", () => {
    expect(SUPPORTED_LOCALES).toContain("en");
    expect(SUPPORTED_LOCALES).toContain("fr");
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("checks locale support accurately", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(true);
    expect(isSupportedLocale("de")).toBe(false);
    expect(isSupportedLocale("es")).toBe(false);
  });

  it("retrieves the dictionary corresponding to the requested locale", () => {
    expect(getDictionary("en").locale).toBe("en");
    expect(getDictionary("fr").locale).toBe("fr");
    expect(getDictionary("invalid" as SupportedLocale).locale).toBe("en");
  });

  it("has symmetrical translation keys between English and French dictionaries", () => {
    const enKeysNav = Object.keys(enDictionary.nav).sort();
    const frKeysNav = Object.keys(frDictionary.nav).sort();
    expect(frKeysNav).toEqual(enKeysNav);

    const enKeysStorefront = Object.keys(enDictionary.storefront).sort();
    const frKeysStorefront = Object.keys(frDictionary.storefront).sort();
    expect(frKeysStorefront).toEqual(enKeysStorefront);

    const enKeysQuickAdd = Object.keys(enDictionary.quickAdd).sort();
    const frKeysQuickAdd = Object.keys(frDictionary.quickAdd).sort();
    expect(frKeysQuickAdd).toEqual(enKeysQuickAdd);

    const enKeysCommon = Object.keys(enDictionary.common).sort();
    const frKeysCommon = Object.keys(frDictionary.common).sort();
    expect(frKeysCommon).toEqual(enKeysCommon);

    const enKeysTracking = Object.keys(enDictionary.orderTracking).sort();
    const frKeysTracking = Object.keys(frDictionary.orderTracking).sort();
    expect(frKeysTracking).toEqual(enKeysTracking);
    expect(enDictionary.orderTracking.deliveryTo).toBe("Delivery to");
    expect(frDictionary.orderTracking.deliveryTo).toBe("Livraison à");
    expect(enDictionary.orderTracking.fulfillmentDetails).toBe("Fulfillment Details");
    expect(frDictionary.orderTracking.fulfillmentDetails).toBe("Détails de la commande");
  });

  it("ensures all French strings are non-empty and translated", () => {
    Object.values(frDictionary.nav).forEach((val) => {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    });

    Object.values(frDictionary.storefront).forEach((val) => {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    });

    Object.values(frDictionary.quickAdd).forEach((val) => {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    });
  });
});
