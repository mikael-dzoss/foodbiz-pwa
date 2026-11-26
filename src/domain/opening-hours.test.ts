import { describe, expect, it } from "vitest";
import {
  CLOSE_TIME_REGEX,
  DAY_KEYS,
  DEFAULT_SLOT_LEAD_MINUTES,
  DEFAULT_SLOT_STEP_MINUTES,
  MAX_RANGES_PER_DAY,
  OPEN_TIME_REGEX,
  SLOT_HORIZON_DAYS,
  allowedDates,
  allowedTimes,
  formatWeeklyHours,
  isOpenAt,
  nextOpening,
  timeRangeSchema,
  validateSlot,
  weeklyHoursSchema,
  type WeeklyHours,
} from "./opening-hours";
import { DEFAULT_TIMEZONE } from "./timezone";

const PARIS = DEFAULT_TIMEZONE; // "Europe/Paris"
const NEW_YORK = "America/New_York";

const EMPTY_WEEK: WeeklyHours = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
};

function makeWeek(overrides: Partial<WeeklyHours> = {}): WeeklyHours {
  return { ...EMPTY_WEEK, ...overrides };
}

/** Standard bistro: Mon–Fri 09:00–12:00 & 14:00–18:00, Sat 10:00–14:00, Sun closed. */
const STANDARD_WEEK: WeeklyHours = makeWeek({
  mon: [
    { open: "09:00", close: "12:00" },
    { open: "14:00", close: "18:00" },
  ],
  tue: [
    { open: "09:00", close: "12:00" },
    { open: "14:00", close: "18:00" },
  ],
  wed: [
    { open: "09:00", close: "12:00" },
    { open: "14:00", close: "18:00" },
  ],
  thu: [
    { open: "09:00", close: "12:00" },
    { open: "14:00", close: "18:00" },
  ],
  fri: [
    { open: "09:00", close: "12:00" },
    { open: "14:00", close: "18:00" },
  ],
  sat: [{ open: "10:00", close: "14:00" }],
  sun: [],
});

describe("opening-hours constants and schemas (#372)", () => {
  it("exports SQL-mirrorable constants and Monday-first day keys", () => {
    expect(DAY_KEYS).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(MAX_RANGES_PER_DAY).toBe(4);
    expect(SLOT_HORIZON_DAYS).toBe(30);
    expect(DEFAULT_SLOT_STEP_MINUTES).toBe(15);
    expect(DEFAULT_SLOT_LEAD_MINUTES).toBe(0);

    expect(OPEN_TIME_REGEX.test("00:00")).toBe(true);
    expect(OPEN_TIME_REGEX.test("23:59")).toBe(true);
    expect(OPEN_TIME_REGEX.test("24:00")).toBe(false);
    expect(CLOSE_TIME_REGEX.test("00:00")).toBe(true);
    expect(CLOSE_TIME_REGEX.test("23:59")).toBe(true);
    expect(CLOSE_TIME_REGEX.test("24:00")).toBe(true);
    expect(CLOSE_TIME_REGEX.test("24:30")).toBe(false);
  });

  it.each([
    { label: "standard morning range", input: { open: "09:00", close: "12:00" } },
    { label: "midnight close 24:00", input: { open: "18:00", close: "24:00" } },
    { label: "full day 00:00–24:00", input: { open: "00:00", close: "24:00" } },
    { label: "one-minute range", input: { open: "23:58", close: "23:59" } },
    { label: "early morning overnight continuation", input: { open: "00:00", close: "01:00" } },
  ])("timeRangeSchema accepts $label", ({ input }) => {
    expect(timeRangeSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { label: "close === open", input: { open: "09:00", close: "09:00" } },
    { label: "close < open", input: { open: "18:00", close: "09:00" } },
    { label: "open === 24:00", input: { open: "24:00", close: "24:00" } },
    { label: "close === 24:30", input: { open: "18:00", close: "24:30" } },
    { label: "close === 24:01", input: { open: "18:00", close: "24:01" } },
    { label: "close === 25:00", input: { open: "18:00", close: "25:00" } },
    { label: "minute 60", input: { open: "09:60", close: "12:00" } },
    { label: "unpadded hour", input: { open: "9:00", close: "12:00" } },
    { label: "seconds included", input: { open: "09:00:00", close: "12:00" } },
    { label: "close === 00:00", input: { open: "00:00", close: "00:00" } },
    { label: "extra property on range", input: { open: "09:00", close: "12:00", extra: true } },
  ])("timeRangeSchema rejects $label", ({ input }) => {
    expect(timeRangeSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { label: "standard week", input: STANDARD_WEEK },
    { label: "fully closed week", input: EMPTY_WEEK },
    {
      label: "4 non-touching ranges on one day",
      input: makeWeek({
        mon: [
          { open: "06:00", close: "09:00" },
          { open: "09:01", close: "12:00" },
          { open: "14:00", close: "17:00" },
          { open: "19:00", close: "24:00" },
        ],
      }),
    },
    {
      label: "overnight split Fri 18:00–24:00 + Sat 00:00–01:00",
      input: makeWeek({
        fri: [{ open: "18:00", close: "24:00" }],
        sat: [{ open: "00:00", close: "01:00" }],
      }),
    },
  ])("weeklyHoursSchema accepts $label", ({ input }) => {
    expect(weeklyHoursSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    {
      label: "overlapping ranges",
      input: makeWeek({
        mon: [
          { open: "09:00", close: "13:00" },
          { open: "12:00", close: "18:00" },
        ],
      }),
    },
    {
      label: "touching ranges (prev.close === next.open)",
      input: makeWeek({
        mon: [
          { open: "09:00", close: "12:00" },
          { open: "12:00", close: "18:00" },
        ],
      }),
    },
    {
      label: "unsorted ranges",
      input: makeWeek({
        mon: [
          { open: "14:00", close: "18:00" },
          { open: "09:00", close: "12:00" },
        ],
      }),
    },
    {
      label: "5 ranges on one day (> max 4)",
      input: makeWeek({
        mon: [
          { open: "06:00", close: "07:00" },
          { open: "08:00", close: "09:00" },
          { open: "10:00", close: "11:00" },
          { open: "12:00", close: "13:00" },
          { open: "14:00", close: "15:00" },
        ],
      }),
    },
    {
      label: "missing day key (sun omitted)",
      input: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] },
    },
    {
      label: "unknown extra key (strict object)",
      input: { ...EMPTY_WEEK, holiday: [] },
    },
    {
      label: "range with close 24:30",
      input: makeWeek({ fri: [{ open: "18:00", close: "24:30" }] }),
    },
  ])("weeklyHoursSchema rejects $label", ({ input }) => {
    expect(weeklyHoursSchema.safeParse(input).success).toBe(false);
  });
});

describe("isOpenAt (#372)", () => {
  const overnightWeek = makeWeek({
    fri: [{ open: "18:00", close: "24:00" }],
    sat: [{ open: "00:00", close: "01:00" }],
  });

  // 2026-07-06 is Monday (CEST = UTC+2 in Paris, EDT = UTC-4 in New York)
  it.each([
    {
      label: "1 minute before open (Paris 08:59)",
      hours: STANDARD_WEEK,
      tz: PARIS,
      at: "2026-07-06T06:59:00Z",
      expected: false,
    },
    {
      label: "exact open minute (Paris 09:00)",
      hours: STANDARD_WEEK,
      tz: PARIS,
      at: "2026-07-06T07:00:00Z",
      expected: true,
    },
    {
      label: "1 minute before close (Paris 11:59)",
      hours: STANDARD_WEEK,
      tz: PARIS,
      at: "2026-07-06T09:59:00Z",
      expected: true,
    },
    {
      label: "exact close minute (Paris 12:00)",
      hours: STANDARD_WEEK,
      tz: PARIS,
      at: "2026-07-06T10:00:00Z",
      expected: false,
    },
    {
      label: "empty day (Sunday in Paris)",
      hours: STANDARD_WEEK,
      tz: PARIS,
      at: "2026-07-12T09:00:00Z",
      expected: false,
    },
    {
      label: "close 24:00 includes 23:59:59 local",
      hours: overnightWeek,
      tz: PARIS,
      at: "2026-07-10T21:59:59Z", // Fri 23:59:59 CEST
      expected: true,
    },
    {
      label: "overnight continuation 00:00 local on Saturday",
      hours: overnightWeek,
      tz: PARIS,
      at: "2026-07-10T22:00:00Z", // Sat 00:00 CEST
      expected: true,
    },
    {
      label: "overnight continuation closed at 01:00 local on Saturday",
      hours: overnightWeek,
      tz: PARIS,
      at: "2026-07-10T23:00:00Z", // Sat 01:00 CEST
      expected: false,
    },
    {
      label: "same UTC instant in New York is Friday 19:00 EDT (open)",
      hours: overnightWeek,
      tz: NEW_YORK,
      at: "2026-07-10T23:00:00Z", // Fri 19:00 EDT
      expected: true,
    },
    {
      label: "24:00 close when next day is closed returns false at 00:00",
      hours: makeWeek({ fri: [{ open: "18:00", close: "24:00" }] }),
      tz: PARIS,
      at: "2026-07-10T22:00:00Z", // Sat 00:00 CEST
      expected: false,
    },
    // DST spring-forward Sunday in Paris: 2026-03-29 (01:59 CET -> 03:00 CEST)
    {
      label: "Paris DST spring-forward: 01:59 CET before 03:00 open",
      hours: makeWeek({ sun: [{ open: "03:00", close: "12:00" }] }),
      tz: PARIS,
      at: "2026-03-29T00:59:00Z", // Sun 01:59 CET
      expected: false,
    },
    {
      label: "Paris DST spring-forward: 03:00 CEST exact open",
      hours: makeWeek({ sun: [{ open: "03:00", close: "12:00" }] }),
      tz: PARIS,
      at: "2026-03-29T01:00:00Z", // Sun 03:00 CEST
      expected: true,
    },
    // DST fall-back Sunday in Paris: 2026-10-25 (02:00–02:59 occurs twice: CEST then CET)
    {
      label: "Paris DST fall-back: first 02:30 (CEST) inside 02:00–03:00",
      hours: makeWeek({ sun: [{ open: "02:00", close: "03:00" }] }),
      tz: PARIS,
      at: "2026-10-25T00:30:00Z", // Sun 02:30 CEST
      expected: true,
    },
    {
      label: "Paris DST fall-back: second 02:30 (CET) inside 02:00–03:00",
      hours: makeWeek({ sun: [{ open: "02:00", close: "03:00" }] }),
      tz: PARIS,
      at: "2026-10-25T01:30:00Z", // Sun 02:30 CET
      expected: true,
    },
    {
      label: "Paris DST fall-back: 03:00 CET exact close",
      hours: makeWeek({ sun: [{ open: "02:00", close: "03:00" }] }),
      tz: PARIS,
      at: "2026-10-25T02:00:00Z", // Sun 03:00 CET
      expected: false,
    },
    // DST spring-forward Sunday in New York: 2026-03-08 (01:59 EST -> 03:00 EDT)
    {
      label: "New York DST spring-forward: 01:59 EST before 03:00 open",
      hours: makeWeek({ sun: [{ open: "03:00", close: "10:00" }] }),
      tz: NEW_YORK,
      at: "2026-03-08T06:59:00Z", // Sun 01:59 EST
      expected: false,
    },
    {
      label: "New York DST spring-forward: 03:00 EDT exact open",
      hours: makeWeek({ sun: [{ open: "03:00", close: "10:00" }] }),
      tz: NEW_YORK,
      at: "2026-03-08T07:00:00Z", // Sun 03:00 EDT
      expected: true,
    },
    // DST fall-back Sunday in New York: 2026-11-01 (01:30 EDT and 01:30 EST)
    {
      label: "New York DST fall-back: second 01:30 EST inside 01:00–02:00",
      hours: makeWeek({ sun: [{ open: "01:00", close: "02:00" }] }),
      tz: NEW_YORK,
      at: "2026-11-01T06:30:00Z", // Sun 01:30 EST
      expected: true,
    },
  ])("$label -> $expected", ({ hours, tz, at, expected }) => {
    expect(isOpenAt(hours, tz, new Date(at))).toBe(expected);
  });
});

describe("nextOpening (#372)", () => {
  it.each([
    {
      label: "already open mid-range returns current local day and time",
      hours: STANDARD_WEEK,
      tz: PARIS,
      from: "2026-07-06T08:23:00Z", // Mon 10:23 CEST
      expected: { date: "2026-07-06", time: "10:23" },
    },
    {
      label: "before first range today returns today open",
      hours: STANDARD_WEEK,
      tz: PARIS,
      from: "2026-07-06T06:15:00Z", // Mon 08:15 CEST
      expected: { date: "2026-07-06", time: "09:00" },
    },
    {
      label: "at exact close of first range returns second range open",
      hours: STANDARD_WEEK,
      tz: PARIS,
      from: "2026-07-06T10:00:00Z", // Mon 12:00 CEST
      expected: { date: "2026-07-06", time: "14:00" },
    },
    {
      label: "Saturday after close crosses Sunday to Monday",
      hours: STANDARD_WEEK,
      tz: PARIS,
      from: "2026-07-11T12:00:00Z", // Sat 14:00 CEST
      expected: { date: "2026-07-13", time: "09:00" },
    },
    {
      label: "Monday-only shop after close wraps 7 days to next Monday",
      hours: makeWeek({ mon: [{ open: "09:00", close: "12:00" }] }),
      tz: PARIS,
      from: "2026-07-06T10:00:00Z", // Mon 12:00 CEST
      expected: { date: "2026-07-13", time: "09:00" },
    },
    {
      label: "fully closed week returns null",
      hours: EMPTY_WEEK,
      tz: PARIS,
      from: "2026-07-06T10:00:00Z",
      expected: null,
    },
    {
      label: "Friday evening in New York (different day than Paris) crosses weekend",
      hours: makeWeek({ mon: [{ open: "08:00", close: "12:00" }] }),
      tz: NEW_YORK,
      from: "2026-07-11T01:00:00Z", // Fri 21:00 EDT (Sat 03:00 in Paris)
      expected: { date: "2026-07-13", time: "08:00" },
    },
    {
      label: "DST spring-forward Saturday evening finds Sunday opening",
      hours: makeWeek({ sun: [{ open: "09:00", close: "13:00" }] }),
      tz: PARIS,
      from: "2026-03-28T22:30:00Z", // Sat 23:30 CET
      expected: { date: "2026-03-29", time: "09:00" },
    },
    {
      label: "DST fall-back Saturday evening finds Sunday opening",
      hours: makeWeek({ sun: [{ open: "09:00", close: "13:00" }] }),
      tz: PARIS,
      from: "2026-10-24T21:30:00Z", // Sat 23:30 CEST
      expected: { date: "2026-10-25", time: "09:00" },
    },
  ])("$label", ({ hours, tz, from, expected }) => {
    expect(nextOpening(hours, tz, new Date(from))).toEqual(expected);
  });
});

describe("allowedTimes (#372)", () => {
  // 2026-07-06 is Monday, 10:00 CEST = 08:00Z
  const mon1000Paris = new Date("2026-07-06T08:00:00Z");

  it.each([
    {
      label: "future date returns all 15-min slots aligned to range opens",
      hours: makeWeek({
        tue: [
          { open: "09:10", close: "10:00" },
          { open: "23:30", close: "24:00" },
        ],
      }),
      date: "2026-07-07",
      tz: PARIS,
      now: mon1000Paris,
      opts: undefined,
      expected: ["09:10", "09:25", "09:40", "09:55", "23:30", "23:45"],
    },
    {
      label: "today with lead=0 excludes current minute (strictly in future)",
      hours: makeWeek({ mon: [{ open: "09:30", close: "10:45" }] }),
      date: "2026-07-06",
      tz: PARIS,
      now: mon1000Paris, // 10:00 local
      opts: { stepMinutes: 15, leadMinutes: 0 },
      expected: ["10:15", "10:30"],
    },
    {
      label: "today at 09:59 with lead=0 includes 10:00",
      hours: makeWeek({ mon: [{ open: "09:30", close: "10:30" }] }),
      date: "2026-07-06",
      tz: PARIS,
      now: new Date("2026-07-06T07:59:00Z"), // 09:59 CEST
      opts: { stepMinutes: 15, leadMinutes: 0 },
      expected: ["10:00", "10:15"],
    },
    {
      label: "today with lead=30 includes exact now+30 (10:30)",
      hours: makeWeek({ mon: [{ open: "09:00", close: "11:00" }] }),
      date: "2026-07-06",
      tz: PARIS,
      now: mon1000Paris, // 10:00 local -> min 10:30
      opts: { stepMinutes: 15, leadMinutes: 30 },
      expected: ["10:30", "10:45"],
    },
    {
      label: "today at 10:01 with lead=30 excludes 10:30 and includes 10:45",
      hours: makeWeek({ mon: [{ open: "09:00", close: "11:00" }] }),
      date: "2026-07-06",
      tz: PARIS,
      now: new Date("2026-07-06T08:01:00Z"), // 10:01 local -> min 10:31
      opts: { stepMinutes: 15, leadMinutes: 30 },
      expected: ["10:45"],
    },
    {
      label: "today past last slot returns empty array",
      hours: makeWeek({ mon: [{ open: "09:00", close: "10:00" }] }),
      date: "2026-07-06",
      tz: PARIS,
      now: mon1000Paris,
      opts: undefined,
      expected: [],
    },
    {
      label: "closed weekday returns empty array",
      hours: STANDARD_WEEK,
      date: "2026-07-12", // Sunday
      tz: PARIS,
      now: mon1000Paris,
      opts: undefined,
      expected: [],
    },
    {
      label: "past date returns empty array",
      hours: STANDARD_WEEK,
      date: "2026-07-05",
      tz: PARIS,
      now: mon1000Paris,
      opts: undefined,
      expected: [],
    },
    {
      label: "invalid calendar date returns empty array",
      hours: STANDARD_WEEK,
      date: "2026-02-30",
      tz: PARIS,
      now: mon1000Paris,
      opts: undefined,
      expected: [],
    },
    {
      label: "malformed date string returns empty array",
      hours: STANDARD_WEEK,
      date: "not-a-date",
      tz: PARIS,
      now: mon1000Paris,
      opts: undefined,
      expected: [],
    },
    {
      label: "Paris DST spring-forward Sunday uses CEST (+02:00) for today cutoff",
      hours: makeWeek({ sun: [{ open: "09:00", close: "11:00" }] }),
      date: "2026-03-29",
      tz: PARIS,
      now: new Date("2026-03-29T08:00:00Z"), // 10:00 CEST (not 09:00 CET)
      opts: { stepMinutes: 30, leadMinutes: 0 },
      expected: ["10:30"],
    },
    {
      label: "custom stepMinutes=30 in New York on today",
      hours: makeWeek({ sun: [{ open: "22:00", close: "24:00" }] }),
      date: "2026-07-05",
      tz: NEW_YORK,
      now: new Date("2026-07-06T02:30:00Z"), // Sun 22:30 EDT
      opts: { stepMinutes: 30, leadMinutes: 0 },
      expected: ["23:00", "23:30"],
    },
  ])("$label", ({ hours, date, tz, now, opts, expected }) => {
    expect(allowedTimes(hours, date, tz, now, opts)).toEqual(expected);
  });

  it("throws on invalid stepMinutes or negative leadMinutes", () => {
    expect(() =>
      allowedTimes(STANDARD_WEEK, "2026-07-07", PARIS, mon1000Paris, { stepMinutes: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      allowedTimes(STANDARD_WEEK, "2026-07-07", PARIS, mon1000Paris, { leadMinutes: -5 }),
    ).toThrow(RangeError);
  });
});

describe("allowedDates (#372)", () => {
  it("returns today..today+horizonDays inclusive, skipping closed days and exhausted today", () => {
    // 2026-07-06 Mon 10:00 CEST (slots remain today)
    const morning = new Date("2026-07-06T08:00:00Z");
    expect(allowedDates(STANDARD_WEEK, PARIS, morning, { horizonDays: 7 })).toEqual([
      "2026-07-06", // Mon
      "2026-07-07", // Tue
      "2026-07-08", // Wed
      "2026-07-09", // Thu
      "2026-07-10", // Fri
      "2026-07-11", // Sat
      // 2026-07-12 Sun closed
      "2026-07-13", // Mon (+7 inclusive)
    ]);

    // 2026-07-06 Mon 17:45 CEST -> last slot is 17:45 (not strictly in future) -> Mon excluded
    const late = new Date("2026-07-06T15:45:00Z");
    expect(allowedDates(STANDARD_WEEK, PARIS, late, { horizonDays: 2 })).toEqual([
      "2026-07-07",
      "2026-07-08",
    ]);
  });

  it("uses default SLOT_HORIZON_DAYS (30) inclusive and returns empty for closed week", () => {
    const allOpen = makeWeek({
      mon: [{ open: "09:00", close: "18:00" }],
      tue: [{ open: "09:00", close: "18:00" }],
      wed: [{ open: "09:00", close: "18:00" }],
      thu: [{ open: "09:00", close: "18:00" }],
      fri: [{ open: "09:00", close: "18:00" }],
      sat: [{ open: "09:00", close: "18:00" }],
      sun: [{ open: "09:00", close: "18:00" }],
    });
    const now = new Date("2026-07-06T08:00:00Z"); // Mon 10:00 CEST
    const dates = allowedDates(allOpen, PARIS, now);
    expect(dates).toHaveLength(31); // today + 30 days inclusive
    expect(dates[0]).toBe("2026-07-06");
    expect(dates[dates.length - 1]).toBe("2026-08-05");

    expect(allowedDates(EMPTY_WEEK, PARIS, now)).toEqual([]);
  });

  it("throws on negative horizonDays", () => {
    expect(() =>
      allowedDates(STANDARD_WEEK, PARIS, new Date("2026-07-06T08:00:00Z"), { horizonDays: -1 }),
    ).toThrow(RangeError);
  });
});

describe("validateSlot (#372)", () => {
  // 2026-07-06 Mon 10:00 CEST = 08:00Z; today+30 = 2026-08-05 (Wed); today+31 = 2026-08-06
  const mon1000Paris = new Date("2026-07-06T08:00:00Z");
  // 2026-07-06 Mon 12:30 CEST = 10:30Z (closed between lunch and afternoon)
  const mon1230Paris = new Date("2026-07-06T10:30:00Z");
  // 2026-07-06 Mon 18:00 CEST = 16:00Z (no slots left today)
  const mon1800Paris = new Date("2026-07-06T16:00:00Z");

  it.each([
    // Window bounds (with hours)
    {
      label: "window bound: today valid",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-06", time: "10:30", isAsap: false },
      opts: undefined,
      expected: { ok: true },
    },
    {
      label: "window bound: today+30 valid",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-08-05", time: "10:30", isAsap: false },
      opts: undefined,
      expected: { ok: true },
    },
    {
      label: "window bound: yesterday rejected",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-05", time: "10:30", isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "date_out_of_window" },
    },
    {
      label: "window bound: today+31 rejected",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-08-06", time: "10:30", isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "date_out_of_window" },
    },
    {
      label: "window bound: invalid calendar date rejected",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-02-30", time: "10:30", isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "date_out_of_window" },
    },
    // Null hours skip
    {
      label: "null hours: skips closed/time checks inside window (scheduled)",
      hours: null,
      tz: PARIS,
      now: mon1800Paris,
      slot: { date: "2026-07-12", time: "03:00", isAsap: false },
      opts: undefined,
      expected: { ok: true },
    },
    {
      label: "null hours: skips closed_now for ASAP inside window",
      hours: null,
      tz: PARIS,
      now: mon1230Paris,
      slot: { date: "2026-07-06", time: null, isAsap: true },
      opts: undefined,
      expected: { ok: true },
    },
    {
      label: "null hours: still enforces window bound (yesterday rejected)",
      hours: null,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-05", time: null, isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "date_out_of_window" },
    },
    {
      label: "null hours: still enforces window bound (today+31 rejected)",
      hours: null,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-08-06", time: null, isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "date_out_of_window" },
    },
    // ASAP
    {
      label: "ASAP when open -> ok",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-06", isAsap: true },
      opts: undefined,
      expected: { ok: true },
    },
    {
      label: "ASAP when closed -> closed_now",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1230Paris,
      slot: { date: "2026-07-06", isAsap: true },
      opts: undefined,
      expected: { ok: false, reason: "closed_now" },
    },
    // Scheduled with time
    {
      label: "scheduled with time on closed weekday -> closed_day",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-12", time: "10:00", isAsap: false }, // Sunday
      opts: undefined,
      expected: { ok: false, reason: "closed_day" },
    },
    {
      label: "scheduled with time outside range (lunch break) -> time_outside_hours",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-07", time: "13:00", isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "time_outside_hours" },
    },
    {
      label: "scheduled with time at exact close -> time_outside_hours",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-07", time: "18:00", isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "time_outside_hours" },
    },
    {
      label: "scheduled with malformed time -> time_outside_hours",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-07", time: "24:00", isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "time_outside_hours" },
    },
    {
      label: "scheduled today at exact now (lead=0) -> time_in_past",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-06", time: "10:00", isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "time_in_past" },
    },
    {
      label: "scheduled today inside lead=30 window (10:15 at 10:00) -> time_in_past",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-06", time: "10:15", isAsap: false },
      opts: { leadMinutes: 30 },
      expected: { ok: false, reason: "time_in_past" },
    },
    {
      label: "scheduled today at exact now+lead (10:30 at 10:00, lead=30) -> ok",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-06", time: "10:30", isAsap: false },
      opts: { leadMinutes: 30 },
      expected: { ok: true },
    },
    // Scheduled without time
    {
      label: "scheduled without time on closed weekday -> closed_day",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-12", time: null, isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "closed_day" },
    },
    {
      label: "scheduled without time today when slots remain -> ok",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1000Paris,
      slot: { date: "2026-07-06", time: null, isAsap: false },
      opts: undefined,
      expected: { ok: true },
    },
    {
      label: "scheduled without time today when no slots remain -> time_in_past",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1800Paris,
      slot: { date: "2026-07-06", time: null, isAsap: false },
      opts: undefined,
      expected: { ok: false, reason: "time_in_past" },
    },
    {
      label: "scheduled without time on open future day -> ok",
      hours: STANDARD_WEEK,
      tz: PARIS,
      now: mon1800Paris,
      slot: { date: "2026-07-07", time: undefined, isAsap: false },
      opts: undefined,
      expected: { ok: true },
    },
    // Different timezone
    {
      label: "New York timezone treats 2026-07-06T02:00Z as Sunday 2026-07-05 (closed)",
      hours: STANDARD_WEEK,
      tz: NEW_YORK,
      now: new Date("2026-07-06T02:00:00Z"), // Sun 22:00 EDT
      slot: { date: "2026-07-05", isAsap: true },
      opts: undefined,
      expected: { ok: false, reason: "closed_now" },
    },
  ])("$label", ({ hours, tz, now, slot, opts, expected }) => {
    expect(validateSlot(hours, tz, now, slot, opts)).toEqual(expected);
  });

  it("throws on invalid horizonDays or negative leadMinutes", () => {
    expect(() =>
      validateSlot(
        STANDARD_WEEK,
        PARIS,
        mon1000Paris,
        { date: "2026-07-06", isAsap: true },
        { horizonDays: -1 },
      ),
    ).toThrow(RangeError);
    expect(() =>
      validateSlot(
        STANDARD_WEEK,
        PARIS,
        mon1000Paris,
        { date: "2026-07-06", isAsap: true },
        { leadMinutes: -1 },
      ),
    ).toThrow(RangeError);
  });
});

describe("formatWeeklyHours (#372)", () => {
  it("formats Monday-first with localized EN and FR labels and en-dash ranges", () => {
    const en = formatWeeklyHours(STANDARD_WEEK, "en");
    expect(en.map((d) => d.day)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
    expect(en.map((d) => d.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(en[0]).toEqual({
      day: "mon",
      label: "Monday",
      ranges: ["09:00–12:00", "14:00–18:00"],
      closed: false,
    });
    expect(en[6]).toEqual({
      day: "sun",
      label: "Sunday",
      ranges: [],
      closed: true,
    });

    const fr = formatWeeklyHours(STANDARD_WEEK, "fr");
    expect(fr.map((d) => d.label)).toEqual([
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
      "dimanche",
    ]);
  });

  it("joins overnight ranges onto day D with (+1) and leaves D+1 ranges empty with closed:false when only range moved", () => {
    const hours = makeWeek({
      fri: [{ open: "18:00", close: "24:00" }],
      sat: [{ open: "00:00", close: "01:00" }],
    });
    const formatted = formatWeeklyHours(hours, "en");
    const fri = formatted.find((d) => d.day === "fri");
    const sat = formatted.find((d) => d.day === "sat");
    const sun = formatted.find((d) => d.day === "sun");

    expect(fri).toEqual({
      day: "fri",
      label: "Friday",
      ranges: ["18:00–01:00 (+1)"],
      closed: false,
    });
    expect(sat).toEqual({
      day: "sat",
      label: "Saturday",
      ranges: [],
      closed: false,
    });
    expect(sun).toEqual({
      day: "sun",
      label: "Sunday",
      ranges: [],
      closed: true,
    });
  });

  it("keeps remaining ranges on D+1 after dropping its absorbed 00:00 range", () => {
    const hours = makeWeek({
      fri: [
        { open: "11:00", close: "14:00" },
        { open: "18:00", close: "24:00" },
      ],
      sat: [
        { open: "00:00", close: "01:30" },
        { open: "11:00", close: "15:00" },
      ],
    });
    const formatted = formatWeeklyHours(hours, "en");
    expect(formatted.find((d) => d.day === "fri")?.ranges).toEqual([
      "11:00–14:00",
      "18:00–01:30 (+1)",
    ]);
    expect(formatted.find((d) => d.day === "sat")).toEqual({
      day: "sat",
      label: "Saturday",
      ranges: ["11:00–15:00"],
      closed: false,
    });
  });

  it("wraps overnight join across sun -> mon", () => {
    const hours = makeWeek({
      sun: [{ open: "19:00", close: "24:00" }],
      mon: [{ open: "00:00", close: "02:00" }],
    });
    const formatted = formatWeeklyHours(hours, "en");
    expect(formatted.find((d) => d.day === "sun")).toEqual({
      day: "sun",
      label: "Sunday",
      ranges: ["19:00–02:00 (+1)"],
      closed: false,
    });
    expect(formatted.find((d) => d.day === "mon")).toEqual({
      day: "mon",
      label: "Monday",
      ranges: [],
      closed: false,
    });
  });

  it("shows a full day 00:00–24:00 as is and never absorbs it or merges into it", () => {
    const fullNext = makeWeek({
      fri: [{ open: "18:00", close: "24:00" }],
      sat: [{ open: "00:00", close: "24:00" }],
    });
    const f1 = formatWeeklyHours(fullNext, "en");
    expect(f1.find((d) => d.day === "fri")?.ranges).toEqual(["18:00–24:00"]);
    expect(f1.find((d) => d.day === "sat")?.ranges).toEqual(["00:00–24:00"]);

    const fullPrev = makeWeek({
      fri: [{ open: "00:00", close: "24:00" }],
      sat: [{ open: "00:00", close: "02:00" }],
    });
    const f2 = formatWeeklyHours(fullPrev, "en");
    expect(f2.find((d) => d.day === "fri")?.ranges).toEqual(["00:00–24:00"]);
    expect(f2.find((d) => d.day === "sat")?.ranges).toEqual(["00:00–02:00"]);
  });

  it("does not join when D ends at 24:00 but D+1 is closed or starts after 00:00", () => {
    const hours = makeWeek({
      fri: [{ open: "18:00", close: "24:00" }],
      sat: [{ open: "09:00", close: "14:00" }],
    });
    const formatted = formatWeeklyHours(hours, "en");
    expect(formatted.find((d) => d.day === "fri")?.ranges).toEqual(["18:00–24:00"]);
    expect(formatted.find((d) => d.day === "sat")?.ranges).toEqual(["09:00–14:00"]);
  });

  it("handles consecutive overnight shifts across sun -> mon -> tue and 24/7 weeks", () => {
    const chain = makeWeek({
      sun: [{ open: "18:00", close: "24:00" }],
      mon: [
        { open: "00:00", close: "02:00" },
        { open: "18:00", close: "24:00" },
      ],
      tue: [{ open: "00:00", close: "01:00" }],
    });
    const formattedChain = formatWeeklyHours(chain, "en");
    expect(formattedChain.find((d) => d.day === "sun")?.ranges).toEqual(["18:00–02:00 (+1)"]);
    expect(formattedChain.find((d) => d.day === "mon")?.ranges).toEqual(["18:00–01:00 (+1)"]);
    expect(formattedChain.find((d) => d.day === "tue")).toEqual({
      day: "tue",
      label: "Tuesday",
      ranges: [],
      closed: false,
    });

    const alwaysOpen: WeeklyHours = {
      mon: [{ open: "00:00", close: "24:00" }],
      tue: [{ open: "00:00", close: "24:00" }],
      wed: [{ open: "00:00", close: "24:00" }],
      thu: [{ open: "00:00", close: "24:00" }],
      fri: [{ open: "00:00", close: "24:00" }],
      sat: [{ open: "00:00", close: "24:00" }],
      sun: [{ open: "00:00", close: "24:00" }],
    };
    const formattedAlways = formatWeeklyHours(alwaysOpen, "en");
    for (const entry of formattedAlways) {
      expect(entry.ranges).toEqual(["00:00–24:00"]);
      expect(entry.closed).toBe(false);
    }
  });
});
