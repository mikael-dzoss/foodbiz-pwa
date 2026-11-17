import { z } from "zod";

/**
 * Business operating time zone (#168). The shop's zone, not the server's or the device's, decides
 * which calendar day an instant belongs to and how a timestamp reads. Every function here takes the
 * zone explicitly; nothing reads the runtime's default zone.
 */

/** The only currency is EUR, so a business starts in the euro area. Managers can change it. */
export const DEFAULT_TIMEZONE = "Europe/Paris";

/** IANA names: `Area/Location[/Sub]` or `UTC`. Mirrors what `pg_timezone_names` accepts. */
const IANA_SHAPE = /^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+)+)$/;

/**
 * Zones offered in the settings select (a fixed list renders identically on server and client;
 * `Intl.supportedValuesOf` differs between runtimes). Any valid IANA zone is still accepted by the
 * schema; a saved zone outside this list is shown as an extra option.
 */
export const SELECTABLE_TIMEZONES = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Lisbon",
  "Europe/Dublin",
  "Europe/London",
  "Europe/Athens",
  "Africa/Douala",
  "Africa/Abidjan",
  "Africa/Algiers",
  "Africa/Casablanca",
  "Africa/Dakar",
  "Africa/Kinshasa",
  "Africa/Tunis",
  "America/New_York",
  "America/Toronto",
  "America/Martinique",
  "America/Guadeloupe",
  "America/Cayenne",
  "America/Montreal",
  "America/Los_Angeles",
  "Indian/Reunion",
  "Indian/Mayotte",
  "Pacific/Noumea",
  "Pacific/Tahiti",
  "UTC",
] as const;

export function isValidTimeZone(value: string): boolean {
  if (!IANA_SHAPE.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().refine(isValidTimeZone, { error: "Invalid time zone" });

export type TimeZone = z.infer<typeof timeZoneSchema>;

export interface ZonedParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 0 = Sunday ... 6 = Saturday */
  readonly weekday: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatters = new Map<string, Intl.DateTimeFormat>();

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Wall-clock parts of an instant in `timeZone`. */
export function getZonedParts(instant: Date | string | number, timeZone: string): ZonedParts {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    formatters.set(timeZone, formatter);
  }
  const date = toDate(instant);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  const byType: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) byType[part.type] = part.value;
  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    weekday: WEEKDAYS.indexOf(byType.weekday),
  };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Calendar day (YYYY-MM-DD) the instant falls on in `timeZone`. */
export function getZonedDay(instant: Date | string | number, timeZone: string): string {
  const p = getZonedParts(instant, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes since local midnight (0-1439) in `timeZone`. */
export function getZonedMinutesOfDay(instant: Date | string | number, timeZone: string): number {
  const p = getZonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

/** Adds whole calendar days to a YYYY-MM-DD string (pure calendar arithmetic, no zone involved). */
export function addCalendarDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The instant at which calendar `day` (YYYY-MM-DD) starts in `timeZone`. DST-safe: a day can be
 * 23 or 25 hours long, so the offset is resolved at the answer, not assumed from the day before.
 */
export function startOfZonedDay(day: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d);
  const offsetAt = (instant: number): number => {
    const p = getZonedParts(instant, timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - instant;
  };
  const first = wallAsUtc - offsetAt(wallAsUtc);
  return new Date(wallAsUtc - offsetAt(first));
}

/** Half-open `[start, end)` instants of calendar `day` in `timeZone`. */
export function getZonedDayBounds(day: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: startOfZonedDay(day, timeZone),
    end: startOfZonedDay(addCalendarDays(day, 1), timeZone),
  };
}
