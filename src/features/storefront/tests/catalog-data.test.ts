import { afterEach, describe, expect, it, vi } from "vitest";
import { revalidatePath, updateTag } from "next/cache";
import {
  evaluateStoreOperatingStatus,
  getStorefrontCatalog,
  getStorefrontProduct,
  revalidateStorefrontCatalog,
} from "../catalog-data";
import { DEMO_BUSINESS_ID, demoBusiness } from "@/lib/repositories/mock/fixtures/business";
import { getMockRepositories } from "@/lib/repositories/mock";
import { createDefaultFixtures } from "@/lib/repositories/mock/fixtures";
import { toStorefrontProduct } from "@/domain/storefront-product";
import { rankFeaturedProducts } from "@/domain/featured";
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
  weeklyHours: null,
  orderTimingAsap: true,
  orderTimingScheduled: true,
  orderTimingTimeOptional: true,
  deliveryFee: 200,
  minOrderAmount: 0,
  leadTimeValue: 1,
  leadTimeUnit: "business_days",
  revolutRevtag: "",
  weroIdentifier: "",
  paymentMethods: {
    cash: true,
    card: false,
    revolut: true,
    wero: true,
  },
  paymentInstructionsEn: "",
  paymentInstructionsFr: "",
  inAppAlerts: true,
  soundAlerts: true,
  timezone: "Europe/Paris",
};

describe("catalog-data (#80, #81, #82, #83)", () => {
  describe("evaluateStoreOperatingStatus", () => {
    it("handles null settings gracefully", () => {
      const res = evaluateStoreOperatingStatus(null, new Date("2026-10-16T10:00:00Z"));
      expect(res.isOpen).toBe(true);
      expect(res.isAcceptingOrders).toBe(true);
      expect(res.scheduleText).toBeNull();
    });

    it("respects acceptingOrders: false regardless of hours", () => {
      const res = evaluateStoreOperatingStatus(
        {
          ...baseSettings,
          acceptingOrders: false,
          openingHours: "08:00 - 18:00",
        },
        new Date("2026-10-16T10:00:00Z"),
      );
      expect(res.isOpen).toBe(false);
      expect(res.isAcceptingOrders).toBe(false);
      expect(res.scheduleText).toBe("08:00 - 18:00");
    });

    it("returns open when current time is within hours", () => {
      const insideHours = new Date("2026-10-16T10:00:00Z"); // 12:00 in Paris (CEST)
      const res = evaluateStoreOperatingStatus(baseSettings, insideHours);
      expect(res.isOpen).toBe(true);
      expect(res.isAcceptingOrders).toBe(true);
    });

    it("returns closed when current time is before opening time", () => {
      const beforeHours = new Date("2026-10-16T04:30:00Z"); // 06:30 in Paris
      const res = evaluateStoreOperatingStatus(baseSettings, beforeHours);
      expect(res.isOpen).toBe(false);
      expect(res.isAcceptingOrders).toBe(true);
    });

    it("returns closed when current time is after closing time", () => {
      const afterHours = new Date("2026-10-16T17:00:00Z"); // 19:00 in Paris
      const res = evaluateStoreOperatingStatus(baseSettings, afterHours);
      expect(res.isOpen).toBe(false);
      expect(res.isAcceptingOrders).toBe(true);
    });

    it("reads the opening hours on the business clock, not the server's", () => {
      const instant = new Date("2026-10-16T10:00:00Z"); // 12:00 Paris, 06:00 New York
      expect(evaluateStoreOperatingStatus(baseSettings, instant).isOpen).toBe(true);
      expect(
        evaluateStoreOperatingStatus({ ...baseSettings, timezone: "America/New_York" }, instant)
          .isOpen,
      ).toBe(false);
    });

    it("handles empty or non-matching opening hours text", () => {
      const noon = new Date("2026-10-16T10:00:00Z");
      const noRegex = evaluateStoreOperatingStatus(
        { ...baseSettings, openingHours: "By appointment only" },
        noon,
      );
      expect(noRegex.isOpen).toBe(true);
      expect(noRegex.scheduleText).toBe("By appointment only");

      const emptyHours = evaluateStoreOperatingStatus(
        { ...baseSettings, openingHours: "   " },
        noon,
      );
      expect(emptyHours.scheduleText).toBeNull();
    });
  });

  describe("getStorefrontCatalog", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each(["recent", "fallback", "empty"] as const)(
      "ranks %s featured items using aggregate-only reads",
      async (scenario) => {
        const now = new Date("2026-11-01T12:00:00.000Z");
        vi.useFakeTimers({ now, toFake: ["Date"] });
        try {
          const fixtures = createDefaultFixtures(now);
          fixtures.settings.openingHours = "";
          const candidate = fixtures.products[0];
          fixtures.orders =
            scenario === "empty"
              ? []
              : [
                  {
                    ...fixtures.orders[0],
                    status: "COMPLETED",
                    paid: "paid",
                    createdAt:
                      scenario === "recent"
                        ? "2026-10-31T12:00:00.000Z"
                        : "2026-10-10T12:00:00.000Z",
                    items: [
                      {
                        productId: candidate.id,
                        productName: candidate.name,
                        quantity: 3,
                        unitPrice: candidate.price,
                        totalPrice: candidate.price * 3,
                      },
                    ],
                  },
                ];
          const repos = getMockRepositories();
          repos.reset(fixtures);
          const privateRead = vi
            .spyOn(repos.orders, "list")
            .mockRejectedValue(new Error("Private orders must not reach storefront"));
          const aggregateRead = vi.spyOn(repos.orders, "sumQuantitiesByProduct");
          const catalog = await getStorefrontCatalog();
          expect(catalog.featuredProducts).toEqual(
            rankFeaturedProducts(fixtures.products, fixtures.orders, now).map(toStorefrontProduct),
          );
          expect(aggregateRead).toHaveBeenCalledTimes(scenario === "recent" ? 1 : 2);
          expect(privateRead).not.toHaveBeenCalled();
          expect(catalog).not.toHaveProperty("orders");
          expect(catalog).not.toHaveProperty("guests");
        } finally {
          vi.useRealTimers();
          getMockRepositories().reset();
        }
      },
    );
    it("returns grouped categories with visible products for the demo business", async () => {
      const catalog = await getStorefrontCatalog();
      expect(catalog.business.name).toBe(demoBusiness.name);
      expect(catalog.groupedCategories.length).toBeGreaterThan(0);
      expect(catalog.totalVisibleProducts).toBeGreaterThan(0);

      for (const group of catalog.groupedCategories) {
        expect(group.products.length).toBeGreaterThan(0);
        for (const prod of group.products) {
          expect(prod.stock).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it("carries weeklyHours and timezone through settings on catalog and product queries", async () => {
      const customHours = {
        mon: [],
        tue: [{ open: "11:30", close: "14:30" }],
        wed: [],
        thu: [],
        fri: [{ open: "18:00", close: "24:00" }],
        sat: [{ open: "00:00", close: "01:00" }],
        sun: [],
      };
      const repos = getMockRepositories();
      try {
        const initialCatalog = await getStorefrontCatalog();
        expect(initialCatalog.settings?.weeklyHours).toBeNull();
        expect(initialCatalog.settings?.timezone).toBe("Europe/Paris");

        await repos.business.updateSettings(DEMO_BUSINESS_ID, {
          weeklyHours: customHours,
          timezone: "Africa/Douala",
        });

        const updatedCatalog = await getStorefrontCatalog();
        expect(updatedCatalog.settings?.weeklyHours).toEqual(customHours);
        expect(updatedCatalog.settings?.timezone).toBe("Africa/Douala");

        const firstProductId = updatedCatalog.groupedCategories[0].products[0].id;
        const productData = await getStorefrontProduct(firstProductId);
        expect(productData?.settings?.weeklyHours).toEqual(customHours);
        expect(productData?.settings?.timezone).toBe("Africa/Douala");
      } finally {
        repos.reset();
      }
    });

    it("throws when the configured business does not exist", async () => {
      vi.stubEnv("STOREFRONT_BUSINESS_ID", "99999999-9999-4999-8999-999999999999");
      try {
        await expect(getStorefrontCatalog()).rejects.toThrow(/Storefront business not found/i);
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe("getStorefrontProduct", () => {
    it("returns full product data for visible product", async () => {
      const catalog = await getStorefrontCatalog();
      const firstProduct = catalog.groupedCategories[0].products[0];

      const productData = await getStorefrontProduct(firstProduct.id);
      expect(productData).not.toBeNull();
      expect(productData?.product.id).toBe(firstProduct.id);
      expect(productData?.categoryName).toBeDefined();
    });

    it("returns null for non-existent product", async () => {
      const productData = await getStorefrontProduct("fake-product-id");
      expect(productData).toBeNull();
    });

    it("returns null when the configured business does not exist", async () => {
      vi.stubEnv("STOREFRONT_BUSINESS_ID", "99999999-9999-4999-8999-999999999999");
      try {
        expect(await getStorefrontProduct("any-id")).toBeNull();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("maps the product through the storefront DTO (no private fields)", async () => {
      const catalog = await getStorefrontCatalog();
      const id = catalog.groupedCategories[0].products[0].id;
      const data = await getStorefrontProduct(id);
      expect(data?.product).not.toHaveProperty("unitCost");
      expect(data?.product).not.toHaveProperty("businessId");
      expect(JSON.stringify(data)).not.toContain("unitCost");
      expect(data?.business).not.toHaveProperty("id");
      expect(data?.business).not.toHaveProperty("slug");
    });
  });

  describe("revalidateStorefrontCatalog", () => {
    it("expires the catalog tags and the storefront layout", () => {
      revalidateStorefrontCatalog(DEMO_BUSINESS_ID);
      expect(updateTag).toHaveBeenCalledWith("storefront-catalog");
      expect(updateTag).toHaveBeenCalledWith(`storefront-catalog-${DEMO_BUSINESS_ID}`);
      expect(revalidatePath).toHaveBeenCalledWith("/[locale]", "layout");
    });
  });
});

describe("catalog-data failure handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("propagates repository failures instead of serving fallback data", async () => {
    vi.spyOn(getMockRepositories().business, "findById").mockRejectedValue(new Error("db down"));
    await expect(getStorefrontCatalog()).rejects.toThrow("db down");
    await expect(getStorefrontProduct("any")).rejects.toThrow("db down");
  });

  it("sends storefront DTOs to the client without private product fields", async () => {
    const catalog = await getStorefrontCatalog();
    const serialized = JSON.stringify(catalog);
    expect(serialized).not.toContain("unitCost");
    expect(serialized).not.toContain('updatedAt":"' + "never");
    for (const group of catalog.groupedCategories) {
      for (const product of group.products) {
        expect(product).not.toHaveProperty("unitCost");
        expect(product).not.toHaveProperty("businessId");
        expect(product.stock).toBeLessThanOrEqual(50);
      }
    }
    expect(catalog.business).not.toHaveProperty("id");
    expect(catalog.business).not.toHaveProperty("createdAt");
    for (const category of catalog.categories) {
      expect(category).not.toHaveProperty("businessId");
      expect(category).not.toHaveProperty("createdAt");
    }
  });
});
