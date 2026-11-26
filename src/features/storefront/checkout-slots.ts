import type { BusinessSettings } from "@/domain/business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import {
  allowedDates,
  allowedTimes,
  isOpenAt,
  nextOpening,
  rangesForDate,
  validateSlot,
  type OpeningSchedule,
  type SlotErrorReason,
} from "@/domain/opening-hours";
import { addCalendarDays, DEFAULT_TIMEZONE, getZonedDay } from "@/domain/timezone";

/** Dictionary key of the localized message for each slot rejection reason. */
export const SLOT_REASON_DICT_KEYS = {
  closed_now: "orderErrorSlotClosedNow",
  closed_day: "orderErrorSlotClosedDay",
  date_out_of_window: "orderErrorSlotDateOutOfWindow",
  time_outside_hours: "orderErrorSlotTimeOutsideHours",
  time_in_past: "orderErrorSlotTimeInPast",
} as const satisfies Record<SlotErrorReason, keyof StorefrontDictionary>;

export type CheckoutSlotIssue = {
  readonly field: "date" | "time";
  readonly messageKey: keyof StorefrontDictionary;
} | null;

export function scheduleFromSettings(settings: BusinessSettings | null): OpeningSchedule {
  return {
    weekly: settings?.weeklyHours ?? null,
    exceptions: settings?.hoursExceptions ?? [],
  };
}

export interface CheckoutSlotOptions {
  readonly dates: string[];
  /** Allowed `HH:MM` slots of the selected date; empty when the date has no structured hours. */
  readonly times: string[];
  /** The selected date has structured hours (weekly schedule or exception). */
  readonly structured: boolean;
  /** Today, the shop is closed at `now` and the day has hours: a time must be chosen. */
  readonly timeRequired: boolean;
  readonly note: string | null;
}

export function buildSlotOptions(
  schedule: OpeningSchedule,
  tz: string,
  now: Date,
  date: string,
): CheckoutSlotOptions {
  const dates = allowedDates(schedule, tz, now);
  const resolved = date ? rangesForDate(schedule, date) : null;
  const structured = resolved !== null;
  return {
    dates,
    times: date && structured ? allowedTimes(schedule, date, tz, now) : [],
    structured,
    timeRequired: structured && date === getZonedDay(now, tz) && !isOpenAt(schedule, tz, now),
    note: resolved?.source === "exception" ? resolved.note : null,
  };
}

/**
 * The reason a scheduled pick cannot be served, or `null` when it can (or nothing is picked yet).
 * Missing time while a time is required is reported as `checkoutTimeRequired`.
 */
export function slotIssue(
  schedule: OpeningSchedule,
  tz: string,
  now: Date,
  date: string,
  time: string,
  timeRequired: boolean,
): CheckoutSlotIssue {
  if (!date) return null;
  // Friendlier than the raw `closed_now` reason while the customer has not chosen a time yet.
  if (timeRequired && !time) return { field: "time", messageKey: "checkoutTimeRequired" };
  const result = validateSlot(schedule, tz, now, { date, time: time || null, isAsap: false });
  if (!result.ok) {
    const field =
      result.reason === "closed_day" || result.reason === "date_out_of_window" ? "date" : "time";
    return { field, messageKey: SLOT_REASON_DICT_KEYS[result.reason] };
  }
  return null;
}

function dateLabelParts(date: string, locale: SupportedLocale, withDate: boolean): string {
  const options: Intl.DateTimeFormatOptions = withDate
    ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
    : { weekday: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, options).format(new Date(`${date}T12:00:00Z`));
}

/** "Today", "Tomorrow" or a short localized weekday and date ("Sat 29 Nov"). */
export function formatSlotDate(
  date: string,
  today: string,
  locale: SupportedLocale,
  dict: StorefrontDictionary,
): string {
  const label = dateLabelParts(date, locale, true);
  if (date === today) return `${dict.today} (${label})`;
  if (date === addCalendarDays(today, 1)) return `${dict.checkoutDateTomorrow} (${label})`;
  return label;
}

/** "Today 18:00", "Tomorrow 11:30" or "Tue 11:30" (weekday + date past a week) for the notice. */
export function formatNextOpeningLabel(
  slot: { date: string; time: string },
  today: string,
  locale: SupportedLocale,
  dict: StorefrontDictionary,
): string {
  const day =
    slot.date === today
      ? dict.today
      : slot.date === addCalendarDays(today, 1)
        ? dict.checkoutDateTomorrow
        : dateLabelParts(slot.date, locale, slot.date >= addCalendarDays(today, 7));
  return dict.checkoutSlotAt.replace("{day}", day).replace("{time}", slot.time);
}

/** Next opening label while `schedule` is closed at `now`, else `null`. */
export function closedNextOpeningLabelForSchedule(
  schedule: OpeningSchedule,
  tz: string,
  now: Date,
  locale: SupportedLocale,
  dict: StorefrontDictionary,
): string | null {
  if (isOpenAt(schedule, tz, now)) return null;
  const next = nextOpening(schedule, tz, now);
  return next ? formatNextOpeningLabel(next, getZonedDay(now, tz), locale, dict) : null;
}

/** Next opening label while the shop is closed per its structured hours, else `null`. */
export function closedNextOpeningLabel(
  settings: BusinessSettings | null,
  now: Date,
  locale: SupportedLocale,
  dict: StorefrontDictionary,
): string | null {
  return closedNextOpeningLabelForSchedule(
    scheduleFromSettings(settings),
    settings?.timezone ?? DEFAULT_TIMEZONE,
    now,
    locale,
    dict,
  );
}
