import { z } from "zod";
import { addCalendarDays, getZonedDay, getZonedMinutesOfDay } from "./timezone";

/**
 * Structured weekly opening hours (#372).
 *
 * Pure, framework-free domain model shared by settings validation, storefront display, and
 * checkout slot validation. Overnight shifts are stored split at midnight (e.g. Fri 18:00–24:00 +
 * Sat 00:00–01:00); formatting joins them back for display.
 *
 * The exported regexes and limits are mirrored in SQL constraints — keep both in sync.
 */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** Open time: "HH:MM" from 00:00 to 23:59 (24:00 is only valid as a close). */
export const OPEN_TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Close time: "HH:MM" from 00:00 to 23:59, or "24:00" for end-of-day midnight. */
export const CLOSE_TIME_REGEX = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** Maximum number of disjoint opening ranges allowed on a single weekday. */
export const MAX_RANGES_PER_DAY = 4;

/** Maximum number of calendar days ahead a scheduled slot may be booked (inclusive). */
export const SLOT_HORIZON_DAYS = 30;

export const DEFAULT_SLOT_STEP_MINUTES = 15;
export const DEFAULT_SLOT_LEAD_MINUTES = 0;

export const openTimeSchema = z
  .string()
  .regex(OPEN_TIME_REGEX, "Open time must be HH:MM between 00:00 and 23:59");

export const closeTimeSchema = z
  .string()
  .regex(CLOSE_TIME_REGEX, "Close time must be HH:MM between 00:00 and 24:00");

export const timeRangeSchema = z
  .strictObject({
    open: openTimeSchema,
    close: closeTimeSchema,
  })
  .refine((range) => range.close > range.open, {
    error: "Close time must be after open time",
    path: ["close"],
  });

export type TimeRange = z.infer<typeof timeRangeSchema>;

export const dayRangesSchema = z
  .array(timeRangeSchema)
  .max(MAX_RANGES_PER_DAY, `At most ${MAX_RANGES_PER_DAY} ranges per day`)
  .superRefine((ranges, ctx) => {
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i - 1].close >= ranges[i].open) {
        ctx.addIssue({
          code: "custom",
          path: [i, "open"],
          message: "Ranges must be sorted, non-overlapping, and non-touching",
        });
      }
    }
  });

export type DayRanges = z.infer<typeof dayRangesSchema>;

export const weeklyHoursSchema = z.strictObject({
  mon: dayRangesSchema,
  tue: dayRangesSchema,
  wed: dayRangesSchema,
  thu: dayRangesSchema,
  fri: dayRangesSchema,
  sat: dayRangesSchema,
  sun: dayRangesSchema,
});

export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;

export interface OpeningSlot {
  readonly date: string;
  readonly time: string;
}

export interface AllowedTimesOptions {
  readonly stepMinutes?: number;
  readonly leadMinutes?: number;
}

export interface AllowedDatesOptions extends AllowedTimesOptions {
  readonly horizonDays?: number;
}

export interface SlotInput {
  readonly date: string;
  readonly time?: string | null;
  readonly isAsap: boolean;
}

export type SlotErrorReason =
  "closed_now" | "date_out_of_window" | "closed_day" | "time_outside_hours" | "time_in_past";

export type SlotValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: SlotErrorReason };

export interface FormattedDayHours {
  readonly day: DayKey;
  readonly label: string;
  readonly ranges: string[];
  readonly closed: boolean;
}

const WEEKDAY_TO_DAY_KEY: readonly DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const ISO_DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EN_DASH = "–";

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseCalendarDayWeekday(day: string): number | null {
  if (!ISO_DAY_REGEX.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== date
  ) {
    return null;
  }
  return utc.getUTCDay();
}

function dayKeyForValidDay(day: string): DayKey {
  const [year, month, date] = day.split("-").map(Number);
  return WEEKDAY_TO_DAY_KEY[new Date(Date.UTC(year, month - 1, date)).getUTCDay()];
}

function isMinuteInRanges(ranges: readonly TimeRange[], minute: number): boolean {
  return ranges.some(
    (range) => parseTimeToMinutes(range.open) <= minute && minute < parseTimeToMinutes(range.close),
  );
}

function minSlotMinuteToday(nowMinutes: number, leadMinutes: number): number {
  return leadMinutes > 0 ? nowMinutes + leadMinutes : nowMinutes + 1;
}

/**
 * Returns true if the local wall-clock minute of `at` in `tz` falls inside any range
 * (`open <= m < close`, with close `"24:00"` equal to 1440).
 */
export function isOpenAt(hours: WeeklyHours, tz: string, at: Date): boolean {
  const day = getZonedDay(at, tz);
  const minutes = getZonedMinutesOfDay(at, tz);
  return isMinuteInRanges(hours[dayKeyForValidDay(day)], minutes);
}

/**
 * Returns the first open `{ date, time }` at or after `from` within 8 calendar days, or `null`
 * if every day of the week is closed. If open at `from`, returns `from`'s local day and time.
 */
export function nextOpening(hours: WeeklyHours, tz: string, from: Date): OpeningSlot | null {
  const today = getZonedDay(from, tz);
  const nowMinutes = getZonedMinutesOfDay(from, tz);
  const todayRanges = hours[dayKeyForValidDay(today)];

  if (isMinuteInRanges(todayRanges, nowMinutes)) {
    return { date: today, time: formatMinutesToTime(nowMinutes) };
  }

  for (const range of todayRanges) {
    if (parseTimeToMinutes(range.open) > nowMinutes) {
      return { date: today, time: range.open };
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const day = addCalendarDays(today, offset);
    const ranges = hours[dayKeyForValidDay(day)];
    if (ranges.length > 0) {
      return { date: day, time: ranges[0].open };
    }
  }

  return null;
}

/**
 * Lists valid slot start times `"HH:MM"` on `date` (`open <= t < close`), stepped from each
 * range's `open` by `stepMinutes`. On today (in `tz`), filters to `t >= now + leadMinutes`
 * (strictly `t > now` when `leadMinutes === 0`). Returns `[]` for past or invalid dates.
 */
export function allowedTimes(
  hours: WeeklyHours,
  date: string,
  tz: string,
  now: Date,
  opts?: AllowedTimesOptions,
): string[] {
  const stepMinutes = opts?.stepMinutes ?? DEFAULT_SLOT_STEP_MINUTES;
  const leadMinutes = opts?.leadMinutes ?? DEFAULT_SLOT_LEAD_MINUTES;
  if (!Number.isInteger(stepMinutes) || stepMinutes <= 0) {
    throw new RangeError("stepMinutes must be a positive integer");
  }
  if (!Number.isFinite(leadMinutes) || leadMinutes < 0) {
    throw new RangeError("leadMinutes must be a non-negative number");
  }

  const weekday = parseCalendarDayWeekday(date);
  if (weekday === null) return [];

  const today = getZonedDay(now, tz);
  if (date < today) return [];

  const ranges = hours[WEEKDAY_TO_DAY_KEY[weekday]];
  if (ranges.length === 0) return [];

  const minMinute =
    date === today ? minSlotMinuteToday(getZonedMinutesOfDay(now, tz), leadMinutes) : 0;

  const slots: string[] = [];
  for (const range of ranges) {
    const open = parseTimeToMinutes(range.open);
    const close = parseTimeToMinutes(range.close);
    for (let t = open; t < close; t += stepMinutes) {
      if (t >= minMinute) {
        slots.push(formatMinutesToTime(t));
      }
    }
  }
  return slots;
}

/**
 * Lists calendar dates `"YYYY-MM-DD"` from `today` through `today + horizonDays` (inclusive)
 * that have at least one allowed time slot.
 */
export function allowedDates(
  hours: WeeklyHours,
  tz: string,
  now: Date,
  opts?: AllowedDatesOptions,
): string[] {
  const horizonDays = opts?.horizonDays ?? SLOT_HORIZON_DAYS;
  if (!Number.isInteger(horizonDays) || horizonDays < 0) {
    throw new RangeError("horizonDays must be a non-negative integer");
  }

  const today = getZonedDay(now, tz);
  const dates: string[] = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const day = addCalendarDays(today, offset);
    if (allowedTimes(hours, day, tz, now, opts).length > 0) {
      dates.push(day);
    }
  }
  return dates;
}

/**
 * Validates an ASAP or scheduled order slot against the booking window and weekly opening hours.
 * The `[today, today + horizonDays]` window always applies even when `hours` is `null`.
 */
export function validateSlot(
  hours: WeeklyHours | null,
  tz: string,
  now: Date,
  slot: SlotInput,
  opts?: AllowedDatesOptions,
): SlotValidationResult {
  const horizonDays = opts?.horizonDays ?? SLOT_HORIZON_DAYS;
  const leadMinutes = opts?.leadMinutes ?? DEFAULT_SLOT_LEAD_MINUTES;
  if (!Number.isInteger(horizonDays) || horizonDays < 0) {
    throw new RangeError("horizonDays must be a non-negative integer");
  }
  if (!Number.isFinite(leadMinutes) || leadMinutes < 0) {
    throw new RangeError("leadMinutes must be a non-negative number");
  }
  const today = getZonedDay(now, tz);
  const maxDate = addCalendarDays(today, horizonDays);

  const weekday = parseCalendarDayWeekday(slot.date);
  if (weekday === null || slot.date < today || slot.date > maxDate) {
    return { ok: false, reason: "date_out_of_window" };
  }

  if (hours === null) {
    return { ok: true };
  }

  if (slot.isAsap) {
    return isOpenAt(hours, tz, now) ? { ok: true } : { ok: false, reason: "closed_now" };
  }

  const ranges = hours[WEEKDAY_TO_DAY_KEY[weekday]];
  if (ranges.length === 0) {
    return { ok: false, reason: "closed_day" };
  }

  if (slot.time != null && slot.time !== "") {
    if (!OPEN_TIME_REGEX.test(slot.time)) {
      return { ok: false, reason: "time_outside_hours" };
    }
    const minutes = parseTimeToMinutes(slot.time);
    if (!isMinuteInRanges(ranges, minutes)) {
      return { ok: false, reason: "time_outside_hours" };
    }
    if (slot.date === today) {
      const minMinute = minSlotMinuteToday(getZonedMinutesOfDay(now, tz), leadMinutes);
      if (minutes < minMinute) {
        return { ok: false, reason: "time_in_past" };
      }
    }
    return { ok: true };
  }

  if (allowedTimes(hours, slot.date, tz, now, opts).length === 0) {
    return { ok: false, reason: "time_in_past" };
  }

  return { ok: true };
}

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();

function formatWeekdayLabel(dayIndex: number, locale: "en" | "fr"): string {
  let formatter = weekdayFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
    weekdayFormatters.set(locale, formatter);
  }
  // 2024-01-01 is a Monday; noon UTC avoids any boundary drift.
  return formatter.format(new Date(Date.UTC(2024, 0, 1 + dayIndex, 12)));
}

function isFullDayRange(range: TimeRange): boolean {
  return range.open === "00:00" && range.close === "24:00";
}

function canJoinOvernight(
  currentRanges: readonly TimeRange[],
  nextRanges: readonly TimeRange[],
): boolean {
  const last = currentRanges.at(-1);
  const nextFirst = nextRanges[0];
  if (!last || !nextFirst) return false;
  if (isFullDayRange(last) || isFullDayRange(nextFirst)) return false;
  return last.close === "24:00" && nextFirst.open === "00:00";
}

/**
 * Formats weekly hours Monday-first with localized weekday labels and en-dash ranges.
 *
 * Overnight join: when day D ends at `"24:00"` (not a full day `00:00–24:00`) and day D+1
 * (wrapping `sun` → `mon`) starts at `"00:00"` ending before `"24:00"`, the continuation is
 * shown on D as `"HH:MM–HH:MM (+1)"` and removed from D+1. D+1 remains `closed: false` if its
 * only range was moved to D.
 */
export function formatWeeklyHours(hours: WeeklyHours, locale: "en" | "fr"): FormattedDayHours[] {
  return DAY_KEYS.map((day, index) => {
    const prevDay = DAY_KEYS[(index + 6) % 7];
    const nextDay = DAY_KEYS[(index + 1) % 7];
    const dayRanges = hours[day];

    const absorbedByPrev = canJoinOvernight(hours[prevDay], dayRanges);
    const absorbsNext = canJoinOvernight(dayRanges, hours[nextDay]);

    const startIndex = absorbedByPrev ? 1 : 0;
    const formattedRanges: string[] = [];

    for (let i = startIndex; i < dayRanges.length; i++) {
      const range = dayRanges[i];
      if (absorbsNext && i === dayRanges.length - 1) {
        formattedRanges.push(`${range.open}${EN_DASH}${hours[nextDay][0].close} (+1)`);
      } else {
        formattedRanges.push(`${range.open}${EN_DASH}${range.close}`);
      }
    }

    return {
      day,
      label: formatWeekdayLabel(index, locale),
      ranges: formattedRanges,
      closed: dayRanges.length === 0,
    };
  });
}
