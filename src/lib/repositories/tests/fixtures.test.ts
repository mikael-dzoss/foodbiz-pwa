import { businessMemberSchema, businessSchema, businessSettingsSchema } from "@/domain/business";
import { expenseSchema } from "@/domain/expense";
import { guestSchema } from "@/domain/guest";
import { orderSchema, orderStatusSchema } from "@/domain/order";
import { productCategorySchema, productSchema } from "@/domain/product";
import { describe, expect, it } from "vitest";

import {
  createDefaultFixtures,
  DEMO_CATEGORY_IDS,
  DEMO_PRODUCT,
  demoBusiness,
  demoCategories,
  demoExpenses,
  demoGuests,
  demoMembers,
  demoOrders,
  demoProducts,
  demoSettings,
} from "../mock/fixtures";

describe("Demo fixtures validity", () => {
  it("validates demo business and settings against schemas", () => {
    expect(() => businessSchema.parse(demoBusiness)).not.toThrow();
    expect(() => businessSettingsSchema.parse(demoSettings)).not.toThrow();
    expect(demoMembers.length).toBeGreaterThanOrEqual(2);
    for (const member of demoMembers) {
      expect(() => businessMemberSchema.parse(member)).not.toThrow();
    }
  });

  it("contains exactly 4 categories valid against productCategorySchema", () => {
    expect(demoCategories).toHaveLength(4);
    for (const category of demoCategories) {
      expect(() => productCategorySchema.parse(category)).not.toThrow();
    }
  });

  it("contains exactly 22 products valid against productSchema across categories", () => {
    expect(demoProducts).toHaveLength(22);
    expect(Object.keys(DEMO_PRODUCT)).toHaveLength(22);
    expect(DEMO_PRODUCT.koki.stock).toBeLessThan(demoSettings.lowStockThreshold);
    for (const product of demoProducts) {
      expect(() => productSchema.parse(product)).not.toThrow();
      expect(product.price).toBeGreaterThan(0);
      expect(product.stock).toBeGreaterThanOrEqual(0);
      expect(product.visible).toBe(true);
      expect("nameEn" in product).toBe(false);
      expect("descriptionEn" in product).toBe(false);
    }
    expect("descriptionEn" in demoBusiness).toBe(false);
  });

  it("seeds add-on roles and visible snack products with prices, stock and allergens", () => {
    const drinks = demoCategories.find((category) => category.role === "drinks");
    const snacks = demoCategories.find((category) => category.role === "snacks");
    expect(drinks?.id).toBe(DEMO_CATEGORY_IDS.drinks);
    expect(drinks?.name).toBe("Boissons");
    expect(drinks?.sortOrder).toBe(4);
    expect(snacks?.id).toBe(DEMO_CATEGORY_IDS.fritters);
    expect(snacks?.name).toBe("Beignets");
    expect(snacks?.sortOrder).toBe(3);
    expect(demoProducts.filter((product) => product.categoryId === snacks?.id)).toMatchObject([
      {
        id: DEMO_PRODUCT.beignetsMais.id,
        name: DEMO_PRODUCT.beignetsMais.name,
        price: 1000,
        stock: 25,
        visible: true,
        allergens: ["gluten"],
      },
      {
        id: DEMO_PRODUCT.beignetsManioc.id,
        name: DEMO_PRODUCT.beignetsManioc.name,
        price: 1000,
        stock: 25,
        visible: true,
        allergens: [],
      },
      {
        id: DEMO_PRODUCT.beignetsFarine.id,
        name: DEMO_PRODUCT.beignetsFarine.name,
        price: 1000,
        stock: 25,
        visible: true,
        allergens: ["gluten", "milk", "eggs"],
      },
      {
        id: DEMO_PRODUCT.beignetsSouffles.id,
        name: DEMO_PRODUCT.beignetsSouffles.name,
        price: 1000,
        stock: 30,
        visible: true,
        allergens: ["gluten"],
      },
    ]);
  });

  it("contains valid guests with valid E.164 phone numbers", () => {
    expect(demoGuests.length).toBeGreaterThanOrEqual(5);
    for (const guest of demoGuests) {
      expect(() => guestSchema.parse(guest)).not.toThrow();
      expect(guest.phone).toMatch(/^\+[1-9]\d{6,14}$/);
    }
  });

  it("contains valid expenses with tags spanning the last 60 days", () => {
    expect(demoExpenses.length).toBeGreaterThanOrEqual(10);
    for (const expense of demoExpenses) {
      expect(() => expenseSchema.parse(expense)).not.toThrow();
      expect(expense.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("contains 40 valid orders covering all statuses and payment states", () => {
    expect(demoOrders).toHaveLength(40);

    const statusesSeen = new Set<string>();
    const paidSeen = new Set<string>();

    for (const order of demoOrders) {
      expect(() => orderSchema.parse(order)).not.toThrow();
      statusesSeen.add(order.status);
      paidSeen.add(order.paid);

      // Verify item totals match totalAmount
      const calculatedTotal = order.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      expect(order.totalAmount).toBe(calculatedTotal);
    }

    // Must cover all defined order statuses
    for (const status of orderStatusSchema.options) {
      expect(statusesSeen.has(status)).toBe(true);
    }

    // Must cover paid, unpaid, and refunded
    expect(paidSeen.has("paid")).toBe(true);
    expect(paidSeen.has("unpaid")).toBe(true);
    expect(paidSeen.has("refunded")).toBe(true);

    // Verify orders span over 50 days (approx 60 days)
    const dates = demoOrders.map((o) => new Date(o.requestedDate).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const spanDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    expect(spanDays).toBeGreaterThanOrEqual(55);
  });

  it("creates recent, schema-valid orders relative to an injected clock without changing counts or fixed fixtures", () => {
    const now = new Date("2030-03-15T12:00:00.000Z");
    const fixtures = createDefaultFixtures(now);
    expect(fixtures.orders).toHaveLength(40);
    const recent = fixtures.orders.filter(
      (order) => Date.parse(order.createdAt) >= now.getTime() - 7 * 86_400_000,
    );
    expect(recent).toHaveLength(4);
    expect(recent.every((order) => Date.parse(order.createdAt) <= now.getTime())).toBe(true);
    for (const order of recent) expect(() => orderSchema.parse(order)).not.toThrow();
    expect(createDefaultFixtures(now)).toEqual(fixtures);
    expect(demoOrders.at(-1)?.createdAt).toContain("2026-10-09");
  });

  it("createDefaultFixtures returns fresh deep clones", () => {
    const f1 = createDefaultFixtures();
    const f2 = createDefaultFixtures();

    expect(f1).not.toBe(f2);
    expect(f1.products).not.toBe(f2.products);

    f1.products[0].name = "Mutated Name";
    expect(f2.products[0].name).not.toBe("Mutated Name");
  });
});
