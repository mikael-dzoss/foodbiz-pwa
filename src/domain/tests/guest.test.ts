import { describe, expect, it } from "vitest";
import {
  findGuestIdByPhone,
  findOrCreateGuest,
  isGuestPhoneUnique,
  isValidPhoneNumber,
  normalizePhoneNumber,
  type Guest,
} from "../guest";

describe("Phone normalisation to E.164", () => {
  it("normalises French mobile numbers with leading 0", () => {
    expect(normalizePhoneNumber("0612345678")).toBe("+33612345678");
    expect(normalizePhoneNumber("0712345678")).toBe("+33712345678");
  });

  it("normalises French landline and VoIP numbers with leading 0", () => {
    expect(normalizePhoneNumber("0123456789")).toBe("+33123456789");
    expect(normalizePhoneNumber("0912345678")).toBe("+33912345678");
  });

  it("handles space-separated numbers in various formats", () => {
    expect(normalizePhoneNumber("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneNumber("  06  12  34  56  78  ")).toBe("+33612345678");
    expect(normalizePhoneNumber("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneNumber("0033 6 12 34 56 78")).toBe("+33612345678");
  });

  it("normalises numbers with international +33 prefix", () => {
    expect(normalizePhoneNumber("+33612345678")).toBe("+33612345678");
    expect(normalizePhoneNumber("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneNumber("+33(0)612345678")).toBe("+33612345678");
    expect(normalizePhoneNumber("+33 (0) 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneNumber("+33 06 12 34 56 78")).toBe("+33612345678");
  });

  it("normalises numbers with European international call prefix 0033", () => {
    expect(normalizePhoneNumber("0033612345678")).toBe("+33612345678");
    expect(normalizePhoneNumber("0033 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneNumber("0033(0)612345678")).toBe("+33612345678");
  });

  it("handles numbers with dots, dashes, and parentheses", () => {
    expect(normalizePhoneNumber("06.12.34.56.78")).toBe("+33612345678");
    expect(normalizePhoneNumber("06-12-34-56-78")).toBe("+33612345678");
    expect(normalizePhoneNumber("(06) 12 34 56 78")).toBe("+33612345678");
  });

  it("normalises 9-digit French numbers without leading 0", () => {
    expect(normalizePhoneNumber("612345678")).toBe("+33612345678");
  });

  it("handles international numbers from other countries with + and 00", () => {
    expect(normalizePhoneNumber("+1 555 123 4567")).toBe("+15551234567");
    expect(normalizePhoneNumber("001 555 123 4567")).toBe("+15551234567");
    expect(normalizePhoneNumber("+44 7911 123456")).toBe("+447911123456");
    expect(normalizePhoneNumber("0044 7911 123456")).toBe("+447911123456");
  });

  it("supports configurable default regions", () => {
    expect(normalizePhoneNumber("2025550123", "US")).toBe("+12025550123");
    expect(normalizePhoneNumber("07911 123456", "GB")).toBe("+447911123456");
  });

  it("rejects invalid or malformed phone numbers", () => {
    expect(() => normalizePhoneNumber("")).toThrow("cannot be empty");
    expect(() => normalizePhoneNumber("   ")).toThrow("cannot be empty");
    expect(() => normalizePhoneNumber("not-a-number")).toThrow();
    expect(() => normalizePhoneNumber("06 12 34")).toThrow(); // Too short
    expect(() => normalizePhoneNumber("061234567890123")).toThrow(); // Too long
    expect(() => normalizePhoneNumber("123", "UNKNOWN_REGION")).toThrow();
  });

  it("isValidPhoneNumber returns boolean without throwing", () => {
    expect(isValidPhoneNumber("06 12 34 56 78")).toBe(true);
    expect(isValidPhoneNumber("+33612345678")).toBe(true);
    expect(isValidPhoneNumber("invalid")).toBe(false);
    expect(isValidPhoneNumber("")).toBe(false);
  });
});

describe("Guest matching rules & uniqueness per (businessId, phone)", () => {
  const businessA = "11111111-1111-4111-8111-111111111111";
  const businessB = "22222222-2222-4222-8222-222222222222";

  const guestA: Guest = {
    id: "33333333-3333-4333-8333-333333333333",
    businessId: businessA,
    name: "Alice Dupont",
    phone: "+33612345678",
    email: "alice@example.com",
    address: "123 Rue de Rivoli",
    notes: "VIP guest, code 4321",
    createdAt: "2026-10-01T10:00:00.000Z",
  };

  const guestB: Guest = {
    id: "44444444-4444-4444-8444-444444444444",
    businessId: businessB,
    name: "Bob Martin",
    phone: "+33612345678", // Same phone, but different business!
    email: "bob@example.com",
    address: "456 Avenue Victor Hugo",
    notes: "Leave at door",
    createdAt: "2026-10-02T10:00:00.000Z",
  };

  it("finds guest id matching different raw phone formats", () => {
    const guests = [guestA, guestB];

    // Different formatting matching guestA
    expect(findGuestIdByPhone(guests, businessA, "06 12 34 56 78")).toBe(guestA.id);
    expect(findGuestIdByPhone(guests, businessA, "0033 6 12 34 56 78")).toBe(guestA.id);
    expect(findGuestIdByPhone(guests, businessA, "+33612345678")).toBe(guestA.id);
    expect(findGuestIdByPhone(guests, businessA, "0612345678")).toBe(guestA.id);
  });

  it("isolates guest identity by businessId", () => {
    const guests = [guestA, guestB];

    // Phone matches both, but businessId isolates them
    expect(findGuestIdByPhone(guests, businessA, "06 12 34 56 78")).toBe(guestA.id);
    expect(findGuestIdByPhone(guests, businessB, "06 12 34 56 78")).toBe(guestB.id);

    // Unknown business
    const businessC = "99999999-9999-4999-8999-999999999999";
    expect(findGuestIdByPhone(guests, businessC, "06 12 34 56 78")).toBeNull();
  });

  it("returns null when phone is not found", () => {
    const guests = [guestA];
    expect(findGuestIdByPhone(guests, businessA, "0699999999")).toBeNull();
  });

  it("checks phone uniqueness per (businessId, phone)", () => {
    const guests = [guestA, guestB];

    // Not unique in businessA
    expect(isGuestPhoneUnique(guests, businessA, "06 12 34 56 78")).toBe(false);

    // Unique if excluding self (for profile update)
    expect(isGuestPhoneUnique(guests, businessA, "06 12 34 56 78", guestA.id)).toBe(true);

    // Unique for an unused phone in businessA
    expect(isGuestPhoneUnique(guests, businessA, "0699999999")).toBe(true);

    // Same phone is unique in a brand new business
    const businessC = "99999999-9999-4999-8999-999999999999";
    expect(isGuestPhoneUnique(guests, businessC, "06 12 34 56 78")).toBe(true);
  });
});

describe("findOrCreateGuest identity & privacy", () => {
  const businessId = "11111111-1111-4111-8111-111111111111";

  it("creates a new guest when not found, returning guestId without exposing stored data", () => {
    const pool: Guest[] = [];

    const result = findOrCreateGuest(pool, {
      businessId,
      name: "Claire",
      phone: "06 12 34 56 78",
      email: "claire@example.com",
    });

    expect(result.isNew).toBe(true);
    expect(typeof result.guestId).toBe("string");
    expect(result.guestId.length).toBeGreaterThan(0);

    // Result object ONLY exposes guestId and isNew — no stored customer details
    expect(Object.keys(result).sort()).toEqual(["guestId", "isNew"]);

    // Pool now has the newly created guest with normalised phone
    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe(result.guestId);
    expect(pool[0].phone).toBe("+33612345678");
    expect(pool[0].name).toBe("Claire");
  });

  it("recognises repeat guest by phone and returns existing guestId WITHOUT exposing stored data", () => {
    const existingGuest: Guest = {
      id: "55555555-5555-4555-8555-555555555555",
      businessId,
      name: "Secret VIP Customer",
      phone: "+33612345678",
      email: "secret@vip.com",
      address: "Confidential Manor",
      notes: "Do not disclose personal info",
      createdAt: "2026-09-01T12:00:00.000Z",
    };
    const pool: Guest[] = [existingGuest];

    // Caller checks out with phone formatted with spaces
    const result = findOrCreateGuest(pool, {
      businessId,
      name: "Checkout Name Attempt",
      phone: "06 12 34 56 78",
      email: "another@checkout.com",
    });

    expect(result.isNew).toBe(false);
    expect(result.guestId).toBe(existingGuest.id);

    // Crucial privacy check: caller only gets guestId, never the stored secret details
    expect(result).toEqual({
      guestId: existingGuest.id,
      isNew: false,
    });
    expect("name" in result).toBe(false);
    expect("email" in result).toBe(false);
    expect("address" in result).toBe(false);
    expect("notes" in result).toBe(false);

    // Pool was NOT duplicated
    expect(pool).toHaveLength(1);
  });

  it("works with custom GuestLookupStore adapter", () => {
    const saved: Guest[] = [];
    const store = {
      findByPhone: () => undefined,
      save: (g: Guest) => {
        saved.push(g);
      },
    };

    const result = findOrCreateGuest(store, {
      businessId,
      name: "David",
      phone: "0033 6 12 34 56 78",
    });

    expect(result.isNew).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(result.guestId);
    expect(saved[0].phone).toBe("+33612345678");
  });

  it("rejects invalid input parameters", () => {
    const pool: Guest[] = [];

    // Invalid businessId UUID
    expect(() =>
      findOrCreateGuest(pool, {
        businessId: "invalid-uuid",
        name: "Test",
        phone: "0612345678",
      }),
    ).toThrow();

    // Non-string input
    expect(() => normalizePhoneNumber(null as unknown as string)).toThrow(
      "Phone number must be a string",
    );

    // Empty name
    expect(() =>
      findOrCreateGuest(pool, {
        businessId,
        name: "   ",
        phone: "0612345678",
      }),
    ).toThrow();

    // Invalid phone
    expect(() =>
      findOrCreateGuest(pool, {
        businessId,
        name: "Test",
        phone: "bad-phone",
      }),
    ).toThrow();
  });

  it("supports options with custom idGenerator, now, and onCreated callback", () => {
    const pool: Guest[] = [];
    const customId = "77777777-7777-4777-8777-777777777777";
    const customTimestamp = "2026-10-09T12:00:00.000Z";
    let capturedCreatedGuest: Guest | undefined;

    const result = findOrCreateGuest(
      pool,
      {
        businessId,
        name: "Emma",
        phone: "06 12 34 56 78",
      },
      {
        idGenerator: () => customId,
        now: () => customTimestamp,
        onCreated: (guest) => {
          capturedCreatedGuest = guest;
        },
      },
    );

    expect(result.guestId).toBe(customId);
    expect(result.isNew).toBe(true);
    expect(capturedCreatedGuest).toBeDefined();
    expect(capturedCreatedGuest?.id).toBe(customId);
    expect(capturedCreatedGuest?.createdAt).toBe(customTimestamp);
  });

  it("handles guests without phone number or with legacy unnormalised phone gracefully", () => {
    const guestWithoutPhone: Guest = {
      id: "88888888-8888-4888-8888-888888888888",
      businessId,
      name: "No Phone Guest",
      phone: null,
      email: null,
      address: null,
      notes: null,
      createdAt: "2026-10-01T10:00:00.000Z",
    };

    const guestLegacyRaw: Guest = {
      id: "99999999-9999-4999-8999-999999999999",
      businessId,
      name: "Legacy Format Guest",
      phone: "+33612345678",
      email: null,
      address: null,
      notes: null,
      createdAt: "2026-10-01T10:00:00.000Z",
    };

    const pool = [guestWithoutPhone, guestLegacyRaw];

    expect(findGuestIdByPhone(pool, businessId, "0612345678")).toBe(guestLegacyRaw.id);
    expect(isGuestPhoneUnique(pool, businessId, "0612345678")).toBe(false);
  });
});
