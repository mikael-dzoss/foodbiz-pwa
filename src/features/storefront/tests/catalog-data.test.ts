import { describe, expect, it } from "vitest";
import {
  evaluateStoreOperatingStatus,
  getStorefrontCatalog,
  getStorefrontProduct,
  revalidateStorefrontCatalog,
} from "../catalog-data";
import { DEMO_BUSINESS_ID } from "@/lib/repositories/mock/fixtures/business";
import type { BusinessSettings } from "@/domain/business";

const baseSettings: BusinessSettings = {
  businessId: DEMO_BUSINESS_ID,
  currency: "EUR",
  dateFormat: "DD/MM/YYYY",
  lowStockThreshold: 5,
  taxPercentage: 10,
  notifications: true,
  acceptingOrders: true,
  serviceTypes: {
    pickup: true,
    delivery: true,
    dineIn: true,
  },
  openingHours: "08:00 - 18:00",
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 200,
  minOrderAmount: 0,
  revolutRevtag: "",
  weroIdentifier: "",
  paymentMethods: {
    cash: true,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "",
  paymentInstructionsFr: "",
  inAppAlerts: true,
  soundAlerts: true,
};

describe("catalog-data (#80, #81, #82, #83)", () => {
  describe("evaluateStoreOperatingStatus", () => {
    it("handles null settings gracefully", () => {
      const res = evaluateStoreOperatingStatus(null);
      expect(res.isOpen).toBe(true);
      expect(res.isAcceptingOrders).toBe(true);
      expect(res.scheduleText).toBeNull();
    });

    it("respects acceptingOrders: false regardless of hours", () => {
      const res = evaluateStoreOperatingStatus({
        ...baseSettings,
        acceptingOrders: false,
        openingHours: "08:00 - 18:00",
      });
      expect(res.isOpen).toBe(false);
      expect(res.isAcceptingOrders).toBe(false);
      expect(res.scheduleText).toBe("08:00 - 18:00");
    });

    it("returns open when current time is within hours", () => {
      const insideHours = new Date(2026, 9, 16, 12, 0, 0); // 12:00
      const res = evaluateStoreOperatingStatus(baseSettings, insideHours);
      expect(res.isOpen).toBe(true);
      expect(res.isAcceptingOrders).toBe(true);
    });

    it("returns closed when current time is before opening time", () => {
      const beforeHours = new Date(2026, 9, 16, 6, 30, 0); // 06:30
      const res = evaluateStoreOperatingStatus(baseSettings, beforeHours);
      expect(res.isOpen).toBe(false);
      expect(res.isAcceptingOrders).toBe(true);
    });

    it("returns closed when current time is after closing time", () => {
      const afterHours = new Date(2026, 9, 16, 19, 0, 0); // 19:00
      const res = evaluateStoreOperatingStatus(baseSettings, afterHours);
      expect(res.isOpen).toBe(false);
      expect(res.isAcceptingOrders).toBe(true);
    });

    it("handles empty or non-matching opening hours text", () => {
      const noRegex = evaluateStoreOperatingStatus({
        ...baseSettings,
        openingHours: "By appointment only",
      });
      expect(noRegex.isOpen).toBe(true);
      expect(noRegex.scheduleText).toBe("By appointment only");

      const emptyHours = evaluateStoreOperatingStatus({
        ...baseSettings,
        openingHours: "   ",
      });
      expect(emptyHours.scheduleText).toBeNull();
    });
  });

  describe("getStorefrontCatalog", () => {
    it("returns grouped categories with visible products for the demo business", async () => {
      const catalog = await getStorefrontCatalog(DEMO_BUSINESS_ID);
      expect(catalog.business.id).toBe(DEMO_BUSINESS_ID);
      expect(catalog.groupedCategories.length).toBeGreaterThan(0);
      expect(catalog.totalVisibleProducts).toBeGreaterThan(0);

      for (const group of catalog.groupedCategories) {
        expect(group.products.length).toBeGreaterThan(0);
        for (const prod of group.products) {
          expect(prod.visible).toBe(true);
        }
      }
    });

    it("throws when business does not exist", async () => {
      await expect(getStorefrontCatalog("non-existent-biz-id")).rejects.toThrow(
        /Storefront business not found/i,
      );
    });
  });

  describe("getStorefrontProduct", () => {
    it("returns full product data for visible product", async () => {
      const catalog = await getStorefrontCatalog(DEMO_BUSINESS_ID);
      const firstProduct = catalog.groupedCategories[0].products[0];

      const productData = await getStorefrontProduct(firstProduct.id, DEMO_BUSINESS_ID);
      expect(productData).not.toBeNull();
      expect(productData?.product.id).toBe(firstProduct.id);
      expect(productData?.categoryName).toBeDefined();
    });

    it("returns null for non-existent product", async () => {
      const productData = await getStorefrontProduct("fake-product-id", DEMO_BUSINESS_ID);
      expect(productData).toBeNull();
    });

    it("returns null when business does not exist", async () => {
      const productData = await getStorefrontProduct("any-id", "non-existent-biz");
      expect(productData).toBeNull();
    });
  });

  describe("revalidateStorefrontCatalog", () => {
    it("runs revalidation without throwing", async () => {
      await expect(revalidateStorefrontCatalog(DEMO_BUSINESS_ID)).resolves.toBeUndefined();
    });
  });
});
