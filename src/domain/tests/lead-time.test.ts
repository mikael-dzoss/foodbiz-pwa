import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEAD_TIME,
  formatLeadTime,
  getLeadTime,
  getLeadTimeNote,
  leadTimeNoteSchema,
  leadTimeValueSchema,
} from "../lead-time";
import { businessSettingsSchema, updateOrderingSettingsSchema } from "../business";

describe("formatLeadTime", () => {
  it.each([
    [{ value: 1, unit: "business_days" }, "en", "~1 business day"],
    [{ value: 3, unit: "business_days" }, "en", "~3 business days"],
    [{ value: 20, unit: "minutes" }, "en", "~20 min"],
    [{ value: 1, unit: "hours" }, "en", "~1 hour"],
    [{ value: 2, unit: "hours" }, "en", "~2 hours"],
    [{ value: 1, unit: "business_days" }, "fr", "~1 jour ouvré"],
    [{ value: 2, unit: "business_days" }, "fr", "~2 jours ouvrés"],
    [{ value: 45, unit: "minutes" }, "fr", "~45 min"],
    [{ value: 1, unit: "hours" }, "fr", "~1 heure"],
    [{ value: 2, unit: "hours" }, "fr", "~2 heures"],
  ] as const)("formats %o in %s as %s", (leadTime, locale, expected) => {
    expect(formatLeadTime(leadTime, locale)).toBe(expected);
  });
});

describe("getLeadTime / getLeadTimeNote", () => {
  it("falls back to one business day", () => {
    expect(getLeadTime(null)).toEqual(DEFAULT_LEAD_TIME);
    expect(getLeadTime({ leadTimeValue: 15, leadTimeUnit: "minutes" })).toEqual({
      value: 15,
      unit: "minutes",
    });
  });

  it("returns the localized note or null when blank", () => {
    const settings = { leadTimeNoteEn: "Baked to order", leadTimeNoteFr: "   " };
    expect(getLeadTimeNote(settings, "en")).toBe("Baked to order");
    expect(getLeadTimeNote(settings, "fr")).toBeNull();
    expect(getLeadTimeNote(undefined, "en")).toBeNull();
  });
});

describe("lead time schemas", () => {
  it("bounds the value and note", () => {
    expect(leadTimeValueSchema.safeParse(1).success).toBe(true);
    expect(leadTimeValueSchema.safeParse(999).success).toBe(true);
    expect(leadTimeValueSchema.safeParse(0).success).toBe(false);
    expect(leadTimeValueSchema.safeParse(1000).success).toBe(false);
    expect(leadTimeValueSchema.safeParse(1.5).success).toBe(false);
    expect(leadTimeNoteSchema.safeParse("x".repeat(280)).success).toBe(true);
    expect(leadTimeNoteSchema.safeParse("x".repeat(281)).success).toBe(false);
  });

  it("defaults settings to one business day without notes", () => {
    const parsed = businessSettingsSchema.parse({
      businessId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parsed).toMatchObject({
      leadTimeValue: 1,
      leadTimeUnit: "business_days",
      leadTimeNoteEn: "",
      leadTimeNoteFr: "",
    });
  });

  it("validates lead time in ordering settings updates", () => {
    const base = {
      acceptingOrders: true,
      serviceTypes: { pickup: true, delivery: false, dineIn: false },
    };
    expect(updateOrderingSettingsSchema.safeParse({ ...base, leadTimeUnit: "hours" }).success).toBe(
      true,
    );
    expect(updateOrderingSettingsSchema.safeParse({ ...base, leadTimeUnit: "weeks" }).success).toBe(
      false,
    );
  });
});
