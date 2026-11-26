import { z } from "zod";
import { addCalendarDays, getZonedDay, getZonedMinutesOfDay } from "./timezone";

/**
 * Structured weekly opening hours (#372) and exceptional days/holidays (#375).
 *
 * Pure, framework-free domain model shared by settings validation, storefront display, and
 * checkout slot validation. Overnight shifts are stored split at midnight (e.g. Fri 18:00–24:00 +
 * Sat 00:00–01:00); formatting joins them back for display. Exceptions override weekly hours for
 * every date they cover (including when weekly hours are null).
 *
 * The exported regexes and limits are mirrored in SQL constraints — keep both in sync.
 */

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** Open time: "HH:MM" from 00:00 to 23:59 (24:00 is only valid as a close). */
export const OPEN_TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

/** Close time: "HH:MM" from 00:00 to 23:59, or "24:00" for end-of-day midnight. */
export const CLOSE_TIME_REGEX = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/** Maximum number of disjoint opening ranges allowed on a single weekday or exception day. */
export const MAX_RANGES_PER_DAY = 4;

/** Maximum number of exception periods allowed per business. */
export const MAX_EXCEPTIONS = 100;

/** Maximum number of inclusive calendar days a single exception period may span. */
export const MAX_EXCEPTION_SPAN_DAYS = 60;

/** Maximum trimmed character length of an exception's optional note. */
export const MAX_EXCEPTION_NOTE_LENGTH = 50;

/** Maximum number of calendar days ahead a scheduled slot may be booked (inclusive). */
export const SLOT_HORIZON_DAYS = 30;

export const DEFAULT_SLOT_STEP_MINUTES = 15;
export const DEFAULT_SLOT_LEAD_MINUTES = 0;

const WEEKDAY_TO_DAY_KEY: readonly DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const ISO_DAY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const EN_DASH = "–";
const MAX_NEXT_OPENING_SCAN_DAYS = 366;

function parseCalendarDayUtc(day: string): Date | null {
  if (!ISO_DAY_REGEX.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);
  if (year < 1) return null;
  const utc = new Date(Date.UTC(year, month - 1, date));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== date
  ) {
    return null;
  }
  return utc;
}

function calendarDayDiff(from: string, to: string): number {
  const fromUtc = parseCalendarDayUtc(from);
  const toUtc = parseCalendarDayUtc(to);
  if (!fromUtc || !toUtc) return Number.NaN;
  return Math.round((toUtc.getTime() - fromUtc.getTime()) / MS_PER_DAY);
}

const calendarDaySchema = z
  .string()
  .refine((value) => parseCalendarDayUtc(value) !== null, {
    error: "Date must be a valid YYYY-MM-DD calendar date",
  });

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

export const hoursExceptionSchema = z
  .strictObject({
    from: calendarDaySchema,
    to: calendarDaySchema,
    ranges: dayRangesSchema,
    note: z
      .string()
      .trim()
      .max(
        MAX_EXCEPTION_NOTE_LENGTH,
        `Note must be ${MAX_EXCEPTION_NOTE_LENGTH} characters or less`,
      )
      .optional(),
  })
  .superRefine((ex, ctx) => {
    if (ex.to < ex.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "End date must be on or after start date",
      });
      return;
    }
    const spanDays = calendarDayDiff(ex.from, ex.to) + 1;
    if (spanDays > MAX_EXCEPTION_SPAN_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Exception span cannot exceed ${MAX_EXCEPTION_SPAN_DAYS} days`,
      });
    }
  });

export type HoursException = z.infer<typeof hoursExceptionSchema>;

export const hoursExceptionsSchema = z
  .array(hoursExceptionSchema)
  .max(MAX_EXCEPTIONS, `At most ${MAX_EXCEPTIONS} exceptions allowed`)
  .superRefine((exceptions, ctx) => {
    const indexed = exceptions
      .map((ex, index) => ({ ex, index }))
      .toSorted(
        (a, b) => a.ex.from.localeCompare(b.ex.from) || a.ex.to.localeCompare(b.ex.to),
      );
    let maxTo: string | null = null;
    for (const item of indexed) {
      if (maxTo !== null && item.ex.from <= maxTo) {
        ctx.addIssue({
          code: "custom",
          path: [item.index, "from"],
          message: "Exception periods must not overlap",
        });
      }
      if (maxTo === null || item.ex.to > maxTo) {
        maxTo = item.ex.to;
      }
    }
  });

export interface OpeningSchedule {
  readonly weekly: WeeklyHours | null;
  readonly exceptions: readonly HoursException[];
}

export interface ResolvedDayHours {
  readonly ranges: TimeRange[];
  readonly note: string | null;
  readonly source: "weekly" | "exception";
}

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
  | "closed_now"
  | "date_out_of_window"
  | "closed_day"
  | "time_outside_hours"
  | "time_in_past";

export type SlotValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: SlotErrorReason };

export interface FormattedDayHours {
  readonly day: DayKey;
  readonly label: string;
  readonly ranges: string[];
  readonly closed: boolean;
}

export interface GroupedDayHours {
  readonly days: DayKey[];
  readonly label: string;
  readonly ranges: string[];
  readonly closed: boolean;
}

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
  const utc = parseCalendarDayUtc(day);
  return utc ? utc.getUTCDay() : null;
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
 * Resolves the effective ranges and optional note for a calendar date `"YYYY-MM-DD"`.
 * An exception covering `date` overrides `schedule.weekly` (even when `weekly` is `null`).
 * Returns `null` when `date` is invalid or has no structured data (`weekly === null` and no exception).
 */
export function rangesForDate(schedule: OpeningSchedule, date: string): ResolvedDayHours | null {
  const weekday = parseCalendarDayWeekday(date);
  if (weekday === null) return null;

  const exception = schedule.exceptions.find((ex) => ex.from <= date && date <= ex.to);
  if (exception) {
    const trimmed = exception.note?.trim();
    return {
      ranges: exception.ranges.map((r) => ({ ...r })),
      note: trimmed ? trimmed : null,
      source: "exception",
    };
  }

  if (schedule.weekly === null) return null;

  return {
    ranges: schedule.weekly[WEEKDAY_TO_DAY_KEY[weekday]].map((r) => ({ ...r })),
    note: null,
    source: "weekly",
  };
}

/**
 * Returns true if the local wall-clock minute of `at` in `tz` falls inside any resolved range
 * (`open <= m < close`, with close `"24:00"` equal to 1440). Returns true when no structured data
 * applies to that date (`weekly === null` and no covering exception).
 */
export function isOpenAt(schedule: OpeningSchedule, tz: string, at: Date): boolean {
  const day = getZonedDay(at, tz);
  const resolved = rangesForDate(schedule, day);
  if (resolved === null) return true;
  const minutes = getZonedMinutesOfDay(at, tz);
  return isMinuteInRanges(resolved.ranges, minutes);
}

/**
 * Returns the first open `{ date, time }` at or after `from`, or `null` if no day opens within
 * the scan window (at least 7 days ahead, extended past any active/upcoming exception periods up
 * to 366 days). If open at `from`, returns `from`'s local day and time.
 */
export function nextOpening(schedule: OpeningSchedule, tz: string, from: Date): OpeningSlot | null {
  const today = getZonedDay(from, tz);
  const nowMinutes = getZonedMinutesOfDay(from, tz);
  const todayResolved = rangesForDate(schedule, today);

  if (todayResolved === null || isMinuteInRanges(todayResolved.ranges, nowMinutes)) {
    return { date: today, time: formatMinutesToTime(nowMinutes) };
  }

  for (const range of todayResolved.ranges) {
    if (parseTimeToMinutes(range.open) > nowMinutes) {
      return { date: today, time: range.open };
    }
  }

  let maxOffset = 7;
  for (const ex of schedule.exceptions) {
    if (ex.to >= today) {
      const diff = calendarDayDiff(today, ex.to);
      if (Number.isFinite(diff) && diff + 7 > maxOffset) {
        maxOffset = Math.min(MAX_NEXT_OPENING_SCAN_DAYS, diff + 7);
      }
    }
  }

  for (let offset = 1; offset <= maxOffset; offset++) {
    const day = addCalendarDays(today, offset);
    const resolved = rangesForDate(schedule, day);
    if (resolved === null) {
      return { date: day, time: "00:00" };
    }
    if (resolved.ranges.length > 0) {
      return { date: day, time: resolved.ranges[0].open };
    }
  }

  return null;
}

/**
 * Lists valid slot start times `"HH:MM"` on `date` (`open <= t < close`), stepped from each
 * resolved range's `open` by `stepMinutes`. On today (in `tz`), filters to `t >= now + leadMinutes`
 * (strictly `t > now` when `leadMinutes === 0`). Returns `[]` for past, invalid, closed, or
 * unconstrained (`rangesForDate === null`) dates.
 */
export function allowedTimes(
  schedule: OpeningSchedule,
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

  const resolved = rangesForDate(schedule, date);
  if (resolved === null || resolved.ranges.length === 0) return [];

  const minMinute =
    date === today ? minSlotMinuteToday(getZonedMinutesOfDay(now, tz), leadMinutes) : 0;

  const slots: string[] = [];
  for (const range of resolved.ranges) {
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
 * that are either unconstrained (`rangesForDate === null`) or have at least one allowed time slot.
 */
export function allowedDates(
  schedule: OpeningSchedule,
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
    if (
      rangesForDate(schedule, day) === null ||
      allowedTimes(schedule, day, tz, now, opts).length > 0
    ) {
      dates.push(day);
    }
  }
  return dates;
}

/**
 * Validates an ASAP or scheduled order slot against the booking window, weekly opening hours,
 * and exception overrides. The `[today, today + horizonDays]` window always applies; hours checks
 * are skipped only when a date has no structured data (`weekly === null` and no exception).
 */
export function validateSlot(
  schedule: OpeningSchedule,
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

  if (slot.isAsap) {
    return isOpenAt(schedule, tz, now) ? { ok: true } : { ok: false, reason: "closed_now" };
  }

  const resolved = rangesForDate(schedule, slot.date);
  if (resolved === null) {
    return { ok: true };
  }

  const { ranges } = resolved;
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

  if (allowedTimes(schedule, slot.date, tz, now, opts).length === 0) {
    return { ok: false, reason: "time_in_past" };
  }

  return { ok: true };
}

/**
 * Returns current or future exception periods (`ex.to >= today` in `tz`), sorted ascending by
 * `from` then `to`, optionally capped to `limit`. Does not mutate the input array.
 */
export function upcomingExceptions(
  exceptions: readonly HoursException[],
  tz: string,
  now: Date,
  limit?: number,
): HoursException[] {
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new RangeError("limit must be a non-negative integer");
  }
  const today = getZonedDay(now, tz);
  const sorted = exceptions
    .filter((ex) => ex.to >= today)
    .toSorted((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    .map((ex) => ({
      ...ex,
      ranges: ex.ranges.map((r) => ({ ...r })),
    }));
  return limit !== undefined ? sorted.slice(0, limit) : sorted;
}

const longWeekdayFormatters = new Map<string, Intl.DateTimeFormat>();
const shortWeekdayFormatters = new Map<string, Intl.DateTimeFormat>();

function formatWeekdayLabel(dayIndex: number, locale: "en" | "fr", width: "long" | "short"): string {
  const cache = width === "long" ? longWeekdayFormatters : shortWeekdayFormatters;
  let formatter = cache.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" });
    cache.set(locale, formatter);
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
      label: formatWeekdayLabel(index, locale, "long"),
      ranges: formattedRanges,
      closed: dayRanges.length === 0,
    };
  });
}

function sameDisplaySchedule(a: FormattedDayHours, b: FormattedDayHours): boolean {
  return (
    a.closed === b.closed &&
    a.ranges.length === b.ranges.length &&
    a.ranges.every((range, idx) => range === b.ranges[idx])
  );
}

/**
 * Groups consecutive Monday-first days from `formatWeeklyHours` that share identical display
 * ranges and closed status (e.g. `"Tue–Thu"` in EN, `"mar.–jeu."` in FR), preserving overnight
 * joins. Single-day groups keep their full localized weekday label.
 */
export function groupWeeklyHours(hours: WeeklyHours, locale: "en" | "fr"): GroupedDayHours[] {
  const formatted = formatWeeklyHours(hours, locale);
  const groups: GroupedDayHours[] = [];

  let i = 0;
  while (i < formatted.length) {
    let j = i;
    while (j + 1 < formatted.length && sameDisplaySchedule(formatted[i], formatted[j + 1])) {
      j++;
    }
    const slice = formatted.slice(i, j + 1);
    const label =
      slice.length === 1
        ? slice[0].label
        : `${formatWeekdayLabel(i, locale, "short")}${EN_DASH}${formatWeekdayLabel(j, locale, "short")}`;
    groups.push({
      days: slice.map((entry) => entry.day),
      label,
      ranges: [...slice[0].ranges],
      closed: slice[0].closed,
    });
    i = j + 1;
  }

  return groups;
}
