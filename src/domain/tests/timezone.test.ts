import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatTime,
  getZonedDay,
  getZonedDayBounds,
  getZonedMinutesOfDay,
  getZonedParts,
  isValidTimeZone,
  startOfZonedDay,
  timeZoneSchema,
} from "../index";
import { DEFAULT_TIMEZONE, safeTimeZone } from "../timezone";

const PARIS = "Europe/Paris";
const DOUALA = "Africa/Douala";
const NEW_YORK = "America/New_York";

describe("time zone validation (#168)", () => {
  it("accepts IANA names, links and UTC", () => {
    for (const zone of [PARIS, DOUALA, NEW_YORK, "UTC", "America/Argentina/Buenos_Aires"]) {
      expect(isValidTimeZone(zone)).toBe(true);
      expect(timeZoneSchema.safeParse(zone).success).toBe(true);
    }
  });

  it("rejects unknown, empty and malformed names", () => {
    for (const zone of ["", "Mars/Olympus_Mons", "Paris", "europe paris", "+01:00", "Europe/"]) {
      expect(isValidTimeZone(zone)).toBe(false);
      expect(timeZoneSchema.safeParse(zone).success).toBe(false);
    }
  });
});

describe("formatting in the business zone (#168)", () => {
  // 22:30 UTC on 9 Oct 2026: 00:30 on the 10th in Paris (CEST), 23:30 in Douala (WAT),
  // 18:30 on the 9th in New York (EDT)
  const instant = new Date("2026-10-09T22:30:00Z");

  it("formats the same instant differently per zone", () => {
    expect(formatDate(instant, PARIS, "en", "short")).toBe("10/10/2026");
    expect(formatTime(instant, PARIS, "en")).toBe("00:30");

    expect(formatDate(instant, DOUALA, "en", "short")).toBe("09/10/2026");
    expect(formatTime(instant, DOUALA, "en")).toBe("23:30");

    expect(formatDate(instant, NEW_YORK, "en", "short")).toBe("09/10/2026");
    expect(formatTime(instant, NEW_YORK, "en")).toBe("18:30");
  });

  it("formats a combined date and time", () => {
    expect(formatDateTime(instant, PARIS, "en")).toBe("10/10/2026 • 00:30");
    expect(formatDateTime(instant.toISOString(), NEW_YORK, "fr")).toBe("09/10/2026 • 18:30");
  });

  it("does not depend on the runtime time zone", () => {
    const previous = process.env.TZ;
    try {
      const outputs = ["Pacific/Auckland", "America/Los_Angeles", "UTC"].map((runtimeZone) => {
        process.env.TZ = runtimeZone;
        return [formatDateTime(instant, PARIS, "en"), getZonedDay(instant, PARIS)];
      });
      expect(new Set(outputs.map((o) => o.join("|"))).size).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("renders a bare calendar day as is, never shifted", () => {
    expect(formatCalendarDate("2026-10-09", "en", "short")).toBe("09/10/2026");
    expect(formatCalendarDate("2026-01-01", "en", "long")).toBe("1 January 2026");
    expect(formatCalendarDate("2026-10-09T00:00:00Z", "fr", "short")).toBe("09/10/2026");
  });
});

describe("invalid stored zones (#168)", () => {
  it("fall back to the default zone instead of throwing while rendering", () => {
    const instant = new Date("2026-10-09T22:30:00Z");
    expect(safeTimeZone("Factory")).toBe(DEFAULT_TIMEZONE);
    expect(safeTimeZone(NEW_YORK)).toBe(NEW_YORK);
    expect(formatTime(instant, "Factory", "en")).toBe(formatTime(instant, DEFAULT_TIMEZONE, "en"));
    expect(formatDate(instant, "Not/AZone", "en", "short")).toBe("10/10/2026");
    expect(getZonedParts(instant, "Factory")).toEqual(getZonedParts(instant, DEFAULT_TIMEZONE));
  });
});

describe("zoned calendar helpers (#168)", () => {
  it("reads wall-clock parts in the zone", () => {
    expect(getZonedParts("2026-10-09T22:30:00Z", PARIS)).toEqual({
      year: 2026,
      month: 10,
      day: 10,
      hour: 0,
      minute: 30,
      weekday: 6, // Saturday
    });
    expect(getZonedMinutesOfDay("2026-10-09T22:30:00Z", NEW_YORK)).toBe(18 * 60 + 30);
  });

  it("assigns an instant to the local calendar day around midnight", () => {
    expect(getZonedDay("2026-10-09T21:59:59Z", PARIS)).toBe("2026-10-09");
    expect(getZonedDay("2026-10-09T22:00:00Z", PARIS)).toBe("2026-10-10");
    expect(getZonedDay("2026-10-10T03:59:59Z", NEW_YORK)).toBe("2026-10-09");
    expect(getZonedDay("2026-10-10T04:00:00Z", NEW_YORK)).toBe("2026-10-10");
  });

  it("throws on an invalid instant", () => {
    expect(() => getZonedDay("nope", PARIS)).toThrow("Invalid date");
  });

  it("adds calendar days across month and year ends", () => {
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("finds local midnight", () => {
    expect(startOfZonedDay("2026-10-09", PARIS).toISOString()).toBe("2026-10-08T22:00:00.000Z");
    expect(startOfZonedDay("2026-01-09", PARIS).toISOString()).toBe("2026-01-08T23:00:00.000Z");
    expect(startOfZonedDay("2026-10-09", NEW_YORK).toISOString()).toBe("2026-10-09T04:00:00.000Z");
    expect(startOfZonedDay("2026-10-09", DOUALA).toISOString()).toBe("2026-10-08T23:00:00.000Z");
  });

  it("makes the spring-forward day 23 hours long in Paris (last Sunday of March)", () => {
    const { start, end } = getZonedDayBounds("2026-03-29", PARIS);
    expect(start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("makes the fall-back day 25 hours long in Paris (last Sunday of October)", () => {
    const { start, end } = getZonedDayBounds("2026-10-25", PARIS);
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it("keeps instants on the right side of a DST change", () => {
    // 01:30 UTC on 29 March is 03:30 CEST (the clock skipped 02:00-03:00)
    expect(getZonedDay("2026-03-29T00:59:59Z", PARIS)).toBe("2026-03-29");
    expect(getZonedMinutesOfDay("2026-03-29T01:00:00Z", PARIS)).toBe(3 * 60);
    // The week and the month roll over on local, not UTC, midnight
    expect(getZonedDay("2026-03-31T22:00:00Z", PARIS)).toBe("2026-04-01");
    expect(getZonedDay("2026-10-31T23:00:00Z", PARIS)).toBe("2026-11-01");
  });
});
