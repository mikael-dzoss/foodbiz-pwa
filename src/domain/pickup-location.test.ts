import { describe, expect, it } from "vitest";

import type { HoursException, WeeklyHours } from "./opening-hours";

import {
  buildDirectionsUrl,
  canDeactivatePickupLocation,
  canDeletePickupLocation,
  canDisableShopPickup,
  createPickupLocationSchema,
  hasActivePickupOption,
  pickupLocationSchema,
  pickupScheduleFor,
  reorderPickupLocationsSchema,
  resolvePickupDisplay,
  updatePickupLocationSchema,
} from "./pickup-location";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const BUSINESS_ID = "33333333-3333-4333-8333-333333333333";

const valid = {
  name: "Gare RER B - La Plaine",
  address: "Place du 8 mai 1945",
  postcode: "93210",
};

describe("createPickupLocationSchema", () => {
  it("applies defaults (free, active, no hours, no description)", () => {
    const parsed = createPickupLocationSchema.parse(valid);
    expect(parsed).toMatchObject({
      feeCents: 0,
      isActive: true,
      weeklyHours: null,
      description: null,
    });
  });

  it("trims text fields", () => {
    expect(createPickupLocationSchema.parse({ ...valid, name: "  Gare  " }).name).toBe("Gare");
  });

  it.each([
    ["empty name", { name: "  " }],
    ["name over 80", { name: "x".repeat(81) }],
    ["description over 200", { description: "x".repeat(201) }],
    ["empty address", { address: "" }],
    ["short postcode", { postcode: "9321" }],
    ["letters in postcode", { postcode: "9321A" }],
    ["negative fee", { feeCents: -1 }],
    ["fee over 100 EUR", { feeCents: 10_001 }],
    ["fractional fee", { feeCents: 1.5 }],
    ["invalid weekly hours", { weeklyHours: { mon: [] } }],
  ])("rejects %s", (_label, patch) => {
    expect(createPickupLocationSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it("accepts the maximum fee", () => {
    expect(createPickupLocationSchema.safeParse({ ...valid, feeCents: 10_000 }).success).toBe(true);
  });
});

describe("updatePickupLocationSchema", () => {
  it("keeps absent fields undefined", () => {
    const parsed = updatePickupLocationSchema.parse({ id: ID_A, name: "New" });
    expect(parsed).toEqual({ id: ID_A, name: "New" });
  });

  it("requires at least one field to change", () => {
    expect(updatePickupLocationSchema.safeParse({ id: ID_A }).success).toBe(false);
    expect(updatePickupLocationSchema.safeParse({ id: ID_A, description: undefined }).success).toBe(
      false,
    );
    expect(updatePickupLocationSchema.safeParse({ id: ID_A, isActive: false }).success).toBe(true);
    expect(updatePickupLocationSchema.safeParse({ id: ID_A, weeklyHours: null }).success).toBe(
      true,
    );
  });

  it("validates provided fields", () => {
    expect(updatePickupLocationSchema.safeParse({ id: ID_A, postcode: "abc" }).success).toBe(false);
    expect(updatePickupLocationSchema.safeParse({ id: "nope" }).success).toBe(false);
    expect(
      updatePickupLocationSchema.parse({ id: ID_A, weeklyHours: null }).weeklyHours,
    ).toBeNull();
  });
});

describe("reorderPickupLocationsSchema", () => {
  it("accepts unique ids and rejects duplicates, empty and oversized lists", () => {
    expect(reorderPickupLocationsSchema.safeParse({ ids: [ID_A, ID_B] }).success).toBe(true);
    expect(reorderPickupLocationsSchema.safeParse({ ids: [ID_A, ID_A] }).success).toBe(false);
    expect(reorderPickupLocationsSchema.safeParse({ ids: [] }).success).toBe(false);
    const many = Array.from(
      { length: 21 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(reorderPickupLocationsSchema.safeParse({ ids: many }).success).toBe(false);
  });
});

describe("pickupLocationSchema", () => {
  it("parses a stored row", () => {
    const row = {
      id: ID_A,
      businessId: BUSINESS_ID,
      ...valid,
      description: null,
      feeCents: 150,
      weeklyHours: null,
      isActive: true,
      sortOrder: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(pickupLocationSchema.parse(row).feeCents).toBe(150);
  });
});

describe("pickup option rules", () => {
  const on = (isActive: boolean, id = ID_A) => ({ id, isActive });
  const ctx = (
    shopPickupEnabled: boolean,
    locations: { id: string; isActive: boolean }[],
    pickupServiceEnabled = true,
  ) => ({ shopPickupEnabled, locations, pickupServiceEnabled });

  it("hasActivePickupOption needs the shop or an active location", () => {
    expect(hasActivePickupOption({ shopPickupEnabled: true, locations: [] })).toBe(true);
    expect(hasActivePickupOption({ shopPickupEnabled: false, locations: [on(true)] })).toBe(true);
    expect(hasActivePickupOption({ shopPickupEnabled: false, locations: [on(false)] })).toBe(false);
    expect(hasActivePickupOption({ shopPickupEnabled: false, locations: [] })).toBe(false);
  });

  it("refuses to deactivate or delete the last option", () => {
    expect(canDeactivatePickupLocation(ctx(false, [on(true)]), ID_A)).toBe(false);
    expect(canDeletePickupLocation(ctx(false, [on(true)]), ID_A)).toBe(false);
  });

  it("allows it while the shop or another location stays active", () => {
    expect(canDeactivatePickupLocation(ctx(true, [on(true)]), ID_A)).toBe(true);
    expect(canDeletePickupLocation(ctx(false, [on(true), on(true, ID_B)]), ID_A)).toBe(true);
  });

  it("allows deleting an already inactive location when the rest is fine", () => {
    expect(canDeletePickupLocation(ctx(false, [on(false), on(true, ID_B)]), ID_A)).toBe(true);
  });

  it("refuses to turn the shop off without an active relay location", () => {
    expect(canDisableShopPickup(ctx(true, []))).toBe(false);
    expect(canDisableShopPickup(ctx(true, [on(false)]))).toBe(false);
    expect(canDisableShopPickup(ctx(true, [on(true)]))).toBe(true);
  });

  it("does not apply while the pickup service type is off", () => {
    expect(canDisableShopPickup(ctx(true, [], false))).toBe(true);
    expect(canDeactivatePickupLocation(ctx(false, [on(true)], false), ID_A)).toBe(true);
    expect(canDeletePickupLocation(ctx(false, [on(true)], false), ID_A)).toBe(true);
  });
});

describe("pickupScheduleFor", () => {
  const open = [{ open: "09:00", close: "18:00" }];
  const relayRanges = [{ open: "07:00", close: "20:00" }];
  const week = (override: Partial<WeeklyHours> = {}): WeeklyHours => ({
    mon: open,
    tue: open,
    wed: open,
    thu: open,
    fri: open,
    sat: open,
    sun: open,
    ...override,
  });
  const closure: HoursException = { from: "2030-01-01", to: "2030-01-02", ranges: [] };
  const special: HoursException = {
    from: "2030-02-01",
    to: "2030-02-01",
    ranges: [{ open: "10:00", close: "12:00" }],
  };

  it("returns the business schedule unchanged when the location has no hours", () => {
    const business = { weekly: week({ mon: [] }), exceptions: [closure, special] };
    expect(pickupScheduleFor(business, null)).toBe(business);
  });

  it("keeps the location ranges but empties the weekdays the business is closed", () => {
    const business = { weekly: week({ mon: [] }), exceptions: [] };
    const result = pickupScheduleFor(business, week({ mon: relayRanges, tue: relayRanges }));
    expect(result.weekly?.mon).toEqual([]);
    expect(result.weekly?.tue).toEqual(relayRanges);
    expect(result.weekly?.wed).toEqual(open);
  });

  it("applies only the business closed exceptions, never its special hours", () => {
    const business = { weekly: week(), exceptions: [closure, special] };
    expect(pickupScheduleFor(business, week()).exceptions).toEqual([closure]);
  });

  it("closes no weekday when the business has no weekly hours, and still applies only closed exceptions", () => {
    const result = pickupScheduleFor(
      { weekly: null, exceptions: [closure, special] },
      week({ sun: relayRanges }),
    );
    expect(result.weekly).toEqual(week({ sun: relayRanges }));
    expect(result.exceptions).toEqual([closure]);
  });

  it("does not mutate its inputs", () => {
    const business = { weekly: week({ mon: [] }), exceptions: [closure, special] };
    const location = week({ mon: relayRanges });
    const before = structuredClone({ business, location });
    pickupScheduleFor(business, location);
    expect({ business, location }).toEqual(before);
  });
});

describe("buildDirectionsUrl and resolvePickupDisplay", () => {
  it("builds an encoded Google Maps search URL and returns null for blank addresses", () => {
    expect(buildDirectionsUrl("12 Place Jean Jaurès, 93100 Montreuil")).toBe(
      "https://www.google.com/maps/search/?api=1&query=12%20Place%20Jean%20Jaur%C3%A8s%2C%2093100%20Montreuil",
    );
    expect(buildDirectionsUrl("   ")).toBeNull();
    expect(buildDirectionsUrl(null)).toBeNull();
    expect(buildDirectionsUrl(undefined)).toBeNull();
  });

  it("returns null for delivery and non-pickup orders", () => {
    expect(
      resolvePickupDisplay(
        "delivery",
        { name: "Relay", address: "10 Rue Relay" },
        { name: "Shop", address: "52 Quai" },
        "Store Pickup",
      ),
    ).toBeNull();
  });

  it("resolves relay location name and address without leaking shop address when relay address is null", () => {
    expect(
      resolvePickupDisplay(
        "pickup",
        { name: "Gare RER B", address: "Place du 8 Mai, 93210" },
        { name: "Les Saveurs", address: "52 Quai de la Rapée" },
        "Store Pickup",
      ),
    ).toEqual({
      isRelay: true,
      name: "Gare RER B",
      address: "Place du 8 Mai, 93210",
      directionsUrl:
        "https://www.google.com/maps/search/?api=1&query=Place%20du%208%20Mai%2C%2093210",
    });

    expect(
      resolvePickupDisplay(
        "pickup",
        { name: "Gare RER B", address: null },
        { name: "Les Saveurs", address: "52 Quai de la Rapée" },
        "Store Pickup",
      ),
    ).toEqual({
      isRelay: true,
      name: "Gare RER B",
      address: null,
      directionsUrl: null,
    });
  });

  it("falls back to the shop name and address when pickupLocation has null name or is absent", () => {
    expect(
      resolvePickupDisplay(
        "pickup",
        { name: null, address: "52 Quai de la Rapée, 75012 Paris" },
        { name: "Les Saveurs", address: "Fallback address" },
        "Store Pickup",
      ),
    ).toEqual({
      isRelay: false,
      name: "Les Saveurs",
      address: "52 Quai de la Rapée, 75012 Paris",
      directionsUrl:
        "https://www.google.com/maps/search/?api=1&query=52%20Quai%20de%20la%20Rap%C3%A9e%2C%2075012%20Paris",
    });

    expect(
      resolvePickupDisplay("pickup", null, { name: "Les Saveurs", address: "52 Quai" }, "Shop"),
    ).toEqual({
      isRelay: false,
      name: "Les Saveurs",
      address: "52 Quai",
      directionsUrl: "https://www.google.com/maps/search/?api=1&query=52%20Quai",
    });

    expect(resolvePickupDisplay("pickup", null, undefined, "Store Pickup")).toEqual({
      isRelay: false,
      name: "Store Pickup",
      address: null,
      directionsUrl: null,
    });
  });
});
