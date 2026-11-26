import { describe, expect, it } from "vitest";
import {
  buildOpenStreetMapEmbedUrl,
  businessMemberSchema,
  businessSchema,
  updateBusinessProfileSchema,
  businessSettingsSchema,
  updatePaymentSettingsSchema,
  expenseSchema,
  guestSchema,
  orderItemSchema,
  orderSchema,
  publicDeliveryAddress,
  publicOrderSchema,
  orderStatusEventSchema,
  manualOrderInputSchema,
  serviceTypeSchema,
  updateOrderStatusInputSchema,
  recordRefundInputSchema,
  paidStatusSchema,
  productCategorySchema,
  productSchema,
} from "../index";

const validUuid = "123e4567-e89b-12d3-a456-426614174000";
const anotherUuid = "987fcdeb-51a2-43d7-9012-345678901234";
const isoNow = "2026-10-09T14:00:00.000Z";

describe("Business schemas", () => {
  it.each(["instagramUrl", "facebookUrl", "tiktokUrl"])("validates optional HTTPS %s", (field) => {
    const profile = { name: "Demo Shop", slug: "demo-shop" };
    const business = { ...profile, id: validUuid, createdAt: isoNow, updatedAt: isoNow };
    for (const schema of [businessSchema, updateBusinessProfileSchema]) {
      const base = schema === businessSchema ? business : profile;
      for (const url of ["https://example.com/shop", "", undefined]) {
        expect(schema.safeParse({ ...base, [field]: url }).success).toBe(true);
      }
      for (const url of ["http://example.com", "invalid", "https://", "ftp://example.com"]) {
        expect(schema.safeParse({ ...base, [field]: url }).success).toBe(false);
      }
    }
  });
  it("validates a valid Business", () => {
    const valid = {
      id: validUuid,
      name: "Les Saveurs du Continent",
      slug: "les-saveurs-du-continent",
      currency: "EUR" as const,
      description: "Home-made Cameroonian cooking in Paris",
      phone: "+33 6 39 98 00 01",
      email: "commandes@example.com",
      whatsappNumber: "+33 6 39 98 00 01",
      address: "52 Quai de la Rapée, 75012 Paris",
      logoUrl: "https://example.com/logo.png",
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    const parsed = businessSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("validates updateBusinessProfileSchema and rejects invalid slug or email", () => {
    const validProfile = {
      name: "Les Saveurs du Continent",
      slug: "les-saveurs-du-continent",
      description: "Fresh grilled dishes daily",
      phone: "+33 6 39 98 00 01",
      email: "info@example.com",
      whatsappNumber: "+33 6 39 98 00 01",
      address: "Paris, France",
      logoUrl: null,
    };
    expect(updateBusinessProfileSchema.safeParse(validProfile).success).toBe(true);

    // Invalid slug (spaces, capital letters, special chars)
    expect(
      updateBusinessProfileSchema.safeParse({
        ...validProfile,
        slug: "Invalid Slug!",
      }).success,
    ).toBe(false);

    // Invalid email
    expect(
      updateBusinessProfileSchema.safeParse({
        ...validProfile,
        email: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("validates latitude/longitude ranges (-90..90, -180..180) and builds OpenStreetMap embed URL (#195)", () => {
    const profile = { name: "Demo Shop", slug: "demo-shop" };
    expect(
      updateBusinessProfileSchema.safeParse({
        ...profile,
        latitude: 48.8553,
        longitude: 2.3726,
      }).success,
    ).toBe(true);

    expect(
      updateBusinessProfileSchema.safeParse({
        ...profile,
        latitude: 95,
        longitude: 2.3726,
      }).success,
    ).toBe(false);

    expect(
      updateBusinessProfileSchema.safeParse({
        ...profile,
        latitude: 48.8553,
        longitude: -190,
      }).success,
    ).toBe(false);

    const url = buildOpenStreetMapEmbedUrl(48.8553, 2.3726, 0.004);
    expect(url).toBe(
      "https://www.openstreetmap.org/export/embed.html?bbox=2.3686,48.8513,2.3766,48.8593&layer=mapnik&marker=48.8553,2.3726",
    );
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

  it("defaults paymentMethods.card to false when omitted in BusinessSettings", () => {
    const parsed = businessSettingsSchema.parse({
      businessId: validUuid,
      paymentMethods: { cash: true, revolut: true, wero: false },
    });
    expect(parsed.paymentMethods).toEqual({
      cash: true,
      card: false,
      revolut: true,
      wero: false,
    });
  });

  it("accepts card-only in updatePaymentSettingsSchema and rejects all methods disabled", () => {
    const cardOnly = updatePaymentSettingsSchema.safeParse({
      paymentMethods: { cash: false, card: true, revolut: false, wero: false },
    });
    expect(cardOnly.success).toBe(true);
    if (cardOnly.success) {
      expect(cardOnly.data.paymentMethods).toEqual({
        cash: false,
        card: true,
        revolut: false,
        wero: false,
      });
    }

    const noneEnabled = updatePaymentSettingsSchema.safeParse({
      paymentMethods: { cash: false, card: false, revolut: false, wero: false },
    });
    expect(noneEnabled.success).toBe(false);

    const missingCard = updatePaymentSettingsSchema.safeParse({
      paymentMethods: { cash: true, revolut: true, wero: true },
    });
    expect(missingCard.success).toBe(false);
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
      productName: "Poulet Braisé",
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
          productName: "Poulet Braisé",
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
      guestId: anotherUuid,
      serviceType: "delivery" as const,
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

  it("validates Order with trackingToken", () => {
    const validOrder = {
      id: validUuid,
      businessId: validUuid,
      guestId: anotherUuid,
      serviceType: "pickup" as const,
      channel: "storefront" as const,
      status: "NEW" as const,
      paid: "unpaid" as const,
      paymentPreference: "on_handover" as const,
      requestedDate: "2026-10-10",
      items: [
        {
          productId: validUuid,
          productName: "Poulet Braisé",
          quantity: 1,
          unitPrice: 150,
          totalPrice: 150,
        },
      ],
      totalAmount: 150,
      trackingToken: "a1b2c3d4e5f6789012345678abcdef01",
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects Order with invalid status, empty items, or malformed requestedDate", () => {
    const base = {
      id: validUuid,
      businessId: validUuid,
      guestId: anotherUuid,
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

  it("validates Order with deliveryAddress and statusHistory", () => {
    const validWithHistory = {
      id: validUuid,
      businessId: validUuid,
      guestId: anotherUuid,
      serviceType: "delivery" as const,
      channel: "phone" as const,
      status: "PREPARING" as const,
      paid: "paid" as const,
      paymentPreference: "revolut" as const,
      deliveryAddress: "123 Rue de Rivoli, Paris",
      requestedDate: "2026-10-10",
      items: [
        {
          productId: validUuid,
          productName: "Burger",
          quantity: 1,
          unitPrice: 850,
          totalPrice: 850,
        },
      ],
      totalAmount: 850,
      statusHistory: [
        { status: "NEW" as const, timestamp: isoNow, note: null },
        { status: "CONFIRMED" as const, timestamp: isoNow, note: "Confirmed" },
        { status: "PREPARING" as const, timestamp: isoNow, note: null },
      ],
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(orderSchema.safeParse(validWithHistory).success).toBe(true);
  });

  it("publicOrderSchema preserves deliveryAddress while stripping private fields (#352)", () => {
    const parsed = publicOrderSchema.parse({
      id: validUuid,
      businessId: validUuid,
      orderNumber: 12,
      guestId: anotherUuid,
      submittedName: "Secret Alias",
      serviceType: "delivery",
      channel: "storefront",
      status: "NEW",
      paid: "unpaid",
      paymentPreference: "on_handover",
      requestedDate: "2026-10-10",
      requestedTime: "12:30",
      totalAmount: 850,
      cancellationReason: null,
      deliveryAddress: "  123 Rue de Rivoli, Paris  ",
      notes: "Door code 1234",
      statusHistory: [{ status: "NEW", timestamp: isoNow, note: null }],
      createdAt: isoNow,
      updatedAt: isoNow,
      items: [
        {
          productId: validUuid,
          productName: "Burger",
          quantity: 1,
          unitPrice: 850,
          totalPrice: 850,
        },
      ],
    });

    expect(parsed.deliveryAddress).toBe("123 Rue de Rivoli, Paris");
    expect(parsed).not.toHaveProperty("guestId");
    expect(parsed).not.toHaveProperty("submittedName");
    expect(parsed).not.toHaveProperty("notes");
    expect(parsed).not.toHaveProperty("statusHistory");
    expect(parsed.items[0]).not.toHaveProperty("productId");

    expect(
      publicOrderSchema.parse({ ...parsed, deliveryAddress: null }).deliveryAddress,
    ).toBeNull();
    const { deliveryAddress: _omit, ...withoutAddress } = parsed;
    expect(publicOrderSchema.parse(withoutAddress).deliveryAddress).toBeUndefined();
  });

  it("publicDeliveryAddress exposes trimmed address only for delivery orders (#352)", () => {
    expect(publicDeliveryAddress("delivery", "  12 Rue de Rivoli, Paris  ")).toBe(
      "12 Rue de Rivoli, Paris",
    );
    expect(publicDeliveryAddress("delivery", "   ")).toBeNull();
    expect(publicDeliveryAddress("delivery", "")).toBeNull();
    expect(publicDeliveryAddress("delivery", null)).toBeNull();
    expect(publicDeliveryAddress("delivery", undefined)).toBeNull();
    expect(publicDeliveryAddress("pickup", "12 Rue de Rivoli, Paris")).toBeNull();
    expect(publicDeliveryAddress("dine-in", "12 Rue de Rivoli, Paris")).toBeNull();
    expect(publicDeliveryAddress(null, "12 Rue de Rivoli, Paris")).toBeNull();
  });

  it("validates orderStatusEventSchema", () => {
    const validEvent = {
      status: "READY" as const,
      timestamp: isoNow,
      note: "Packaging done",
    };
    expect(orderStatusEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("validates manualOrderInputSchema and rejects invalid input", () => {
    const valid = {
      guestPhone: "+33612345678",
      guestName: "Jean Dupont",
      serviceType: "pickup" as const,
      channel: "phone" as const,
      isAsap: true,
      items: [{ productId: validUuid, quantity: 2 }],
    };
    expect(manualOrderInputSchema.safeParse(valid).success).toBe(true);

    // Rejects empty items
    expect(manualOrderInputSchema.safeParse({ ...valid, items: [] }).success).toBe(false);

    // Rejects non-positive quantity
    expect(
      manualOrderInputSchema.safeParse({
        ...valid,
        items: [{ productId: validUuid, quantity: 0 }],
      }).success,
    ).toBe(false);
  });

  it("validates updateOrderStatusInputSchema and rejects invalid input", () => {
    const valid = {
      orderId: validUuid,
      nextStatus: "CONFIRMED" as const,
      reason: "Confirmed by kitchen",
    };
    expect(updateOrderStatusInputSchema.safeParse(valid).success).toBe(true);
    expect(updateOrderStatusInputSchema.safeParse({ ...valid, orderId: "bad-id" }).success).toBe(
      false,
    );
    expect(
      updateOrderStatusInputSchema.safeParse({ ...valid, nextStatus: "UNKNOWN" }).success,
    ).toBe(false);
  });

  it("validates paidStatusSchema with paid, unpaid, and refunded", () => {
    expect(paidStatusSchema.safeParse("paid").success).toBe(true);
    expect(paidStatusSchema.safeParse("unpaid").success).toBe(true);
    expect(paidStatusSchema.safeParse("refunded").success).toBe(true);
    expect(paidStatusSchema.safeParse("partial").success).toBe(false);
  });

  it("validates Order with paid: 'refunded' and optional refundedAt", () => {
    const refundedOrder = {
      id: validUuid,
      businessId: validUuid,
      guestId: anotherUuid,
      serviceType: "pickup" as const,
      channel: "storefront" as const,
      status: "CANCELLED" as const,
      paid: "refunded" as const,
      paymentPreference: "revolut" as const,
      paymentMethod: "revolut" as const,
      paidAt: isoNow,
      refundedAt: isoNow,
      requestedDate: "2026-10-10",
      items: [
        {
          productId: validUuid,
          productName: "Poulet Braisé",
          quantity: 2,
          unitPrice: 150,
          totalPrice: 300,
        },
      ],
      totalAmount: 300,
      createdAt: isoNow,
      updatedAt: isoNow,
    };
    expect(orderSchema.safeParse(refundedOrder).success).toBe(true);
  });

  it("validates recordRefundInputSchema", () => {
    const valid = {
      orderId: validUuid,
      reason: "Customer cancelled prior to preparation",
    };
    expect(recordRefundInputSchema.safeParse(valid).success).toBe(true);

    const validNoReason = {
      orderId: validUuid,
    };
    expect(recordRefundInputSchema.safeParse(validNoReason).success).toBe(true);

    const invalidUuid = {
      orderId: "invalid-id",
    };
    expect(recordRefundInputSchema.safeParse(invalidUuid).success).toBe(false);
  });
});

describe("Expense schema", () => {
  it("validates Expense with businessId and tags", () => {
    const valid = {
      id: validUuid,
      businessId: validUuid,
      amount: 15000, // 150.00 EUR
      date: "2026-10-09",
      description: "Plantains & spices wholesale",
      tags: ["Ingredients", "Kitchen"],
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

describe("order service types: read tolerance, strict input", () => {
  const stored = {
    id: "66666666-6666-4666-8666-666666666601",
    businessId: "11111111-1111-4111-8111-111111111111",
    guestId: "55555555-5555-4555-8555-555555555501",
    channel: "in-person" as const,
    status: "NEW" as const,
    paid: "unpaid" as const,
    paymentPreference: "on_handover" as const,
    requestedDate: "2026-10-15",
    items: [
      {
        productId: "33333333-3333-4333-8333-333333333301",
        productName: "Burger",
        quantity: 1,
        unitPrice: 850,
        totalPrice: 850,
      },
    ],
    totalAmount: 850,
    createdAt: "2026-10-15T10:00:00.000Z",
    updatedAt: "2026-10-15T10:00:00.000Z",
  };

  it("reads every value of the database enum, including dine-in", () => {
    for (const serviceType of ["pickup", "delivery", "dine-in"]) {
      expect(orderSchema.safeParse({ ...stored, serviceType }).success).toBe(true);
    }
    expect(orderSchema.safeParse({ ...stored, serviceType: "drive-through" }).success).toBe(false);
  });

  it("keeps the input schemas to pickup and delivery", () => {
    expect(serviceTypeSchema.safeParse("dine-in").success).toBe(false);
    expect(
      manualOrderInputSchema.safeParse({
        guestPhone: "+33612345678",
        guestName: "Jean Dupont",
        serviceType: "dine-in",
        channel: "phone",
        items: [{ productId: "33333333-3333-4333-8333-333333333301", quantity: 1 }],
      }).success,
    ).toBe(false);
  });
});
