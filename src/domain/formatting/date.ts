import type { SupportedLocale } from "../i18n/types";

function toDate(date: Date | string | number): Date {
  if (date instanceof Date) {
    return date;
  }
  return new Date(date);
}

const LOCALE_MAP: Record<SupportedLocale, string> = {
  en: "en-GB",
  fr: "fr-FR",
};

/**
 * Formats a date into a localized date string, as the calendar day in `timeZone` (the business
 * zone), never the server's or the device's.
 */
export function formatDate(
  date: Date | string | number,
  timeZone: string,
  locale: SupportedLocale = "en",
  style: "short" | "medium" | "long" = "medium",
): string {
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { year: "numeric", month: "2-digit", day: "2-digit" }
      : style === "long"
        ? { year: "numeric", month: "long", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" };
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], { ...options, timeZone }).format(toDate(date));
}

/**
 * Formats a date's time portion (HH:mm, 24-hour) in `timeZone`.
 */
export function formatTime(
  date: Date | string | number,
  timeZone: string,
  locale: SupportedLocale = "en",
): string {
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(toDate(date));
}

/** Short date and time in `timeZone`, e.g. "09/10/2026 • 16:30". */
export function formatDateTime(
  date: Date | string | number,
  timeZone: string,
  locale: SupportedLocale = "en",
): string {
  return `${formatDate(date, timeZone, locale, "short")} • ${formatTime(date, timeZone, locale)}`;
}

/**
 * Formats a bare calendar day (YYYY-MM-DD, e.g. an order's requested date or an expense date).
 * A calendar day has no zone, so it is rendered as is and never shifted.
 */
export function formatCalendarDate(
  day: string,
  locale: SupportedLocale = "en",
  style: "short" | "medium" | "long" = "medium",
): string {
  return formatDate(`${day.slice(0, 10)}T12:00:00Z`, "UTC", locale, style);
}

/**
 * Formats relative time (e.g. "in 5 minutes", "2 hours ago").
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date | string | number,
  locale: SupportedLocale = "en",
): string {
  const d = toDate(date);
  const base = toDate(baseDate);
  const diffInSeconds = Math.round((d.getTime() - base.getTime()) / 1000);

  const intlLocale = LOCALE_MAP[locale];
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });

  const absDiff = Math.abs(diffInSeconds);

  if (absDiff < 60) {
    return rtf.format(diffInSeconds, "second");
  }

  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return rtf.format(diffInMinutes, "minute");
  }

  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return rtf.format(diffInHours, "hour");
  }

  const diffInDays = Math.round(diffInHours / 24);
  if (Math.abs(diffInDays) < 30) {
    return rtf.format(diffInDays, "day");
  }

  const diffInMonths = Math.round(diffInDays / 30);
  if (Math.abs(diffInMonths) < 12) {
    return rtf.format(diffInMonths, "month");
  }

  const diffInYears = Math.round(diffInDays / 365);
  return rtf.format(diffInYears, "year");
}
