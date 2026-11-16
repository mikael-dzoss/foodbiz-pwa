import { describe, it, expect } from "vitest";
import {
  checkoutFormSchema,
  guestContactStorageSchema,
  GUEST_CONTACT_STORAGE_KEY,
  mergeDuplicateItems,
  placeOrderInputSchema,
} from "../checkout";

describe("checkoutFormSchema", () => {
  const validPickupBase = {
    name: "Jean Dupont",
    phone: "+33612345678",
    serviceType: "pickup" as const,
    isAsap: true,
    paymentPreference: "on_handover" as const,
  };

  it("validates valid ASAP pickup checkout data", () => {
    const result = checkoutFormSchema.safeParse(validPickupBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Jean Dupont");
      expect(result.data.phone).toBe("+33612345678");
      expect(result.data.serviceType).toBe("pickup");
      expect(result.data.isAsap).toBe(true);
    }
  });

  it("normalises guest name with Unicode NFC and trims extra spaces", () => {
    const result = checkoutFormSchema.safeParse({
      ...validPickupBase,
      name: "  Léa   Martin  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Léa Martin");
    }
  });

  it("fails when name is too short (< 2 characters)", () => {
    const result = checkoutFormSchema.safeParse({
      ...validPickupBase,
      name: "J",
    });
    expect(result.success).toBe(false);
  });

  it("fails when phone number is invalid", () => {
    const result = checkoutFormSchema.safeParse({
      ...validPickupBase,
      phone: "invalid-phone",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("phone"))).toBe(true);
    }
  });

  it("requires delivery address when serviceType is delivery", () => {
    const withoutAddress = checkoutFormSchema.safeParse({
      ...validPickupBase,
      serviceType: "delivery",
      deliveryAddress: "",
    });
    expect(withoutAddress.success).toBe(false);
    if (!withoutAddress.success) {
      expect(withoutAddress.error.issues.some((i) => i.path.includes("deliveryAddress"))).toBe(
        true,
      );
    }

    const withAddress = checkoutFormSchema.safeParse({
      ...validPickupBase,
      serviceType: "delivery",
      deliveryAddress: "12 Rue de la Paix, Paris",
    });
    expect(withAddress.success).toBe(true);
  });

  it("requires requestedDate when isAsap is false", () => {
    const withoutDate = checkoutFormSchema.safeParse({
      ...validPickupBase,
      isAsap: false,
    });
    expect(withoutDate.success).toBe(false);
    if (!withoutDate.success) {
      expect(withoutDate.error.issues.some((i) => i.path.includes("requestedDate"))).toBe(true);
    }

    const withDate = checkoutFormSchema.safeParse({
      ...validPickupBase,
      isAsap: false,
      requestedDate: "2026-10-30",
      requestedTime: "14:30",
    });
    expect(withDate.success).toBe(true);
  });

  it("allows valid payment preferences", () => {
    for (const pref of ["revolut", "wero", "on_handover"] as const) {
      const result = checkoutFormSchema.safeParse({
        ...validPickupBase,
        paymentPreference: pref,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("guestContactStorageSchema", () => {
  it("validates valid stored guest contact", () => {
    expect(GUEST_CONTACT_STORAGE_KEY).toBe("foodbiz_guest_contact");
    const result = guestContactStorageSchema.safeParse({
      name: "Marie Curie",
      phone: "+33612345678",
    });
    expect(result.success).toBe(true);
  });

  it("fails on invalid contact storage object", () => {
    const result = guestContactStorageSchema.safeParse({
      name: "",
      phone: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("placeOrderInputSchema", () => {
  const validBase = {
    items: [
      {
        productId: "11111111-1111-4111-8111-111111111111",
        quantity: 2,
      },
    ],
    name: "Thomas Pesquet",
    phone: "+33612345678",
    serviceType: "pickup" as const,
    isAsap: true,
    paymentPreference: "on_handover" as const,
    idempotencyKey: "f0000000-0000-4000-8000-000000000001",
  };

  it("validates valid order placement input", () => {
    const result = placeOrderInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.idempotencyKey).toBe("f0000000-0000-4000-8000-000000000001");
      expect(result.data.name).toBe("Thomas Pesquet");
    }
  });

  it("fails when items list is empty", () => {
    const result = placeOrderInputSchema.safeParse({
      ...validBase,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("fails when item quantity is less than 1", () => {
    const result = placeOrderInputSchema.safeParse({
      ...validBase,
      items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("fails when idempotencyKey is missing or too short", () => {
    const result = placeOrderInputSchema.safeParse({
      ...validBase,
      idempotencyKey: "short",
    });
    expect(result.success).toBe(false);
  });

  it("requires the idempotency key to be a uuid", () => {
    expect(
      placeOrderInputSchema.safeParse({ ...validBase, idempotencyKey: "not-a-uuid-at-all" })
        .success,
    ).toBe(false);
  });

  it("caps the delivery address (300) and the number of lines (50) like place_order", () => {
    const item = { productId: "11111111-1111-4111-8111-111111111111", quantity: 1 };
    expect(
      placeOrderInputSchema.safeParse({
        ...validBase,
        serviceType: "delivery",
        deliveryAddress: "a".repeat(300),
      }).success,
    ).toBe(true);
    expect(
      placeOrderInputSchema.safeParse({
        ...validBase,
        serviceType: "delivery",
        deliveryAddress: "a".repeat(301),
      }).success,
    ).toBe(false);
    expect(
      placeOrderInputSchema.safeParse({ ...validBase, items: Array(50).fill(item) }).success,
    ).toBe(true);
    expect(
      placeOrderInputSchema.safeParse({ ...validBase, items: Array(51).fill(item) }).success,
    ).toBe(false);
  });

  it("enforces delivery address when serviceType is delivery", () => {
    const result = placeOrderInputSchema.safeParse({
      ...validBase,
      serviceType: "delivery",
      deliveryAddress: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("mergeDuplicateItems", () => {
  const a = "33333333-3333-4333-8333-333333333301";
  const b = "33333333-3333-4333-8333-333333333302";

  it("sums quantities per product and keeps first-seen order", () => {
    const input = [
      { productId: a, quantity: 2 },
      { productId: b, quantity: 1 },
      { productId: a, quantity: 3 },
    ];
    expect(mergeDuplicateItems(input)).toEqual([
      { productId: a, quantity: 5 },
      { productId: b, quantity: 1 },
    ]);
    expect(input).toHaveLength(3);
  });
});
