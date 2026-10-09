import type { SupportedLocale } from "./money";

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
 * Formats a date into a localized date string.
 */
export function formatDate(
  date: Date | string | number,
  locale: SupportedLocale = "en",
  style: "short" | "medium" | "long" = "medium",
): string {
  const d = toDate(date);
  const intlLocale = LOCALE_MAP[locale];

  if (style === "short") {
    return new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  if (style === "long") {
    return new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  }

  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Formats a date's time portion (HH:mm).
 */
export function formatTime(date: Date | string | number, locale: SupportedLocale = "en"): string {
  const d = toDate(date);
  const intlLocale = LOCALE_MAP[locale];

  return new Intl.DateTimeFormat(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Formats relative time (e.g. "in 5 minutes", "2 hours ago").
 */
export function formatRelativeTime(
  date: Date | string | number,
  baseDate: Date | string | number = new Date(),
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
