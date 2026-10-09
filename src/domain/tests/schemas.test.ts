import { describe, expect, it } from "vitest";
import {
  businessMemberSchema,
  businessSchema,
  businessSettingsSchema,
  expenseSchema,
  guestSchema,
  orderItemSchema,
  orderSchema,
  productCategorySchema,
  productSchema,
} from "../index";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";
const anotherUuid = "987fcdeb-51a2-43d7-9012-345678901234";
const isoNow = "2026-10-09T14:00:00.000Z";

describe("Business schemas", () => {
  it("validates a valid Business", () => {
    const valid = {
      id: validUuid,
      name: "La Petite Boulangerie",
      slug: "la-petite-boulangerie",
      currency: "EUR" as const,
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    const parsed = businessSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects Business with invalid UUID or non-EUR currency", () => {
    expect(
      businessSchema.safeParse({
        id: "not-a-uuid",
        name: "Test",
        slug: "test",
        currency: "USD",
        createdAt: isoNow,
        updatedAt: isoNow,
      }).success,
    ).toBe(false);
  });

  it("validates BusinessMember with valid roles", () => {
    const valid = {
      id: validUuid,
      businessId: validUuid,
      userId: anotherUuid,
      role: "owner" as const,
      createdAt: isoNow,
    };
    expect(businessMemberSchema.safeParse(valid).success).toBe(true);

    const invalid = { ...valid, role: "superadmin" };
    expect(businessMemberSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates BusinessSettings with default values", () => {
    const valid = {
      businessId: validUuid,
      dateFormat: "DD/MM/YYYY" as const,
      lowStockThreshold: 5,
      taxPercentage: 10,
      notifications: true,
    };
    const parsed = businessSettingsSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe("EUR");
    }
  });

  it("rejects BusinessSettings with negative lowStockThreshold", () => {
    const invalid = {
      businessId: validUuid,
      lowStockThreshold: -1,
    };
    expect(businessSettingsSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("Product schemas", () => {
  it("validates ProductCategory with businessId", () => {
    const valid = {
      id: validUuid,
      businessId: validUuid,
      name: "Juice",
      sortOrder: 1,
      createdAt: isoNow,
    };
    expect(productCategorySchema.safeParse(valid).success).toBe(true);

    const missingBusiness = {
      id: validUuid,
      name: "Juice",
      createdAt: isoNow,
    };
    expect(productCategorySchema.safeParse(missingBusiness).success).toBe(false);
  });

  it("validates Product with price and unitCost in integer cents", () => {
    const valid = {
      id: validUuid,
      businessId: validUuid,
      categoryId: anotherUuid,
      name: "Orange Juice 500ml",
      price: 450, // 4.50 EUR
      unitCost: 150, // 1.50 EUR
      stock: 25,
      visible: true,
      imageUrl: null,
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(productSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects Product with fractional cents or negative stock", () => {
    const fractionalPrice = {
      id: validUuid,
      businessId: validUuid,
      categoryId: anotherUuid,
      name: "Invalid",
      price: 4.5, // Not integer cents
      unitCost: 0,
      stock: 10,
      visible: true,
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(productSchema.safeParse(fractionalPrice).success).toBe(false);

    const negativeStock = {
      ...fractionalPrice,
      price: 450,
      stock: -5,
    };
    expect(productSchema.safeParse(negativeStock).success).toBe(false);
  });
});

describe("Guest schema", () => {
  it("validates Guest with businessId and optional contact details", () => {
    const valid = {
      id: validUuid,
      businessId: validUuid,
      name: "Alice Dupont",
      phone: "+33612345678",
      email: "alice@example.com",
      address: "123 Rue de Paris",
      notes: "Door code 1234",
      createdAt: isoNow,
    };
    expect(guestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects Guest missing businessId or invalid email", () => {
    expect(
      guestSchema.safeParse({
        id: validUuid,
        name: "Alice",
        email: "not-an-email",
        createdAt: isoNow,
      }).success,
    ).toBe(false);
  });
});

describe("Order and OrderItem schemas", () => {
  it("validates OrderItem with integer cents and positive quantity", () => {
    const validItem = {
      productId: validUuid,
      productName: "Croissant",
      quantity: 3,
      unitPrice: 150,
      totalPrice: 450,
    };
    expect(orderItemSchema.safeParse(validItem).success).toBe(true);

    const invalidQty = { ...validItem, quantity: 0 };
    expect(orderItemSchema.safeParse(invalidQty).success).toBe(false);

    const invalidPrice = { ...validItem, unitPrice: -10 };
    expect(orderItemSchema.safeParse(invalidPrice).success).toBe(false);
  });

  it("validates complete Order with all required fields", () => {
    const validOrder = {
      id: validUuid,
      businessId: validUuid,
      orderNumber: 42,
      guestId: anotherUuid,
      guestName: "Alice Dupont",
      serviceType: "pickup" as const,
      channel: "storefront" as const,
      status: "NEW" as const,
      paid: "unpaid" as const,
      paymentPreference: "on_handover" as const,
      paymentMethod: null,
      paidAt: null,
      requestedDate: "2026-10-10",
      requestedTime: "12:30",
      items: [
        {
          productId: validUuid,
          productName: "Croissant",
          quantity: 2,
          unitPrice: 150,
          totalPrice: 300,
        },
      ],
      totalAmount: 300,
      cancellationReason: null,
      notes: "Extra napkins",
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("validates Order without optional requestedTime and orderNumber", () => {
    const validOrder = {
      id: validUuid,
      businessId: validUuid,
      guestName: "Bob",
      serviceType: "dine-in" as const,
      channel: "in-person" as const,
      status: "CONFIRMED" as const,
      paid: "paid" as const,
      paymentPreference: "revolut" as const,
      paymentMethod: "revolut" as const,
      paidAt: isoNow,
      requestedDate: "2026-10-10",
      items: [
        {
          productId: validUuid,
          productName: "Coffee",
          quantity: 1,
          unitPrice: 250,
          totalPrice: 250,
        },
      ],
      totalAmount: 250,
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects Order with invalid status, empty items, or malformed requestedDate", () => {
    const base = {
      id: validUuid,
      businessId: validUuid,
      guestName: "Bob",
      serviceType: "pickup" as const,
      channel: "phone" as const,
      status: "UNKNOWN_STATUS",
      paid: "unpaid" as const,
      paymentPreference: "wero" as const,
      requestedDate: "2026-10-10",
      items: [
        {
          productId: validUuid,
          productName: "Coffee",
          quantity: 1,
          unitPrice: 250,
          totalPrice: 250,
        },
      ],
      totalAmount: 250,
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(orderSchema.safeParse(base).success).toBe(false);

    // Empty items
    expect(
      orderSchema.safeParse({
        ...base,
        status: "NEW",
        items: [],
      }).success,
    ).toBe(false);

    // Malformed requestedDate
    expect(
      orderSchema.safeParse({
        ...base,
        status: "NEW",
        requestedDate: "10-10-2026",
      }).success,
    ).toBe(false);
  });
});

describe("Expense schema", () => {
  it("validates Expense with businessId and tags", () => {
    const valid = {
      id: validUuid,
      businessId: validUuid,
      amount: 15000, // 150.00 EUR
      date: "2026-10-09",
      description: "Butter & Flour wholesale",
      tags: ["Ingredients", "Bakery"],
      createdAt: isoNow,
    };
    expect(expenseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects Expense with negative amount or missing businessId", () => {
    expect(
      expenseSchema.safeParse({
        id: validUuid,
        amount: -500,
        date: "2026-10-09",
        description: "Negative expense",
        tags: [],
        createdAt: isoNow,
      }).success,
    ).toBe(false);
  });
});

describe("Architectural boundaries", () => {
  it("ensures no React, Next.js, or Supabase imports in src/domain/", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const domainDir = path.resolve(__dirname, "..");
    const files = fs
      .readdirSync(domainDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(domainDir, file), "utf-8");
      expect(content).not.toMatch(/from\s+["']react["']/);
      expect(content).not.toMatch(/from\s+["']next/);
      expect(content).not.toMatch(/from\s+["']@supabase/);
    }
  });
});
