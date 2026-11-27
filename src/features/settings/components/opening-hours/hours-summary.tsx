"use client";

import { Fragment } from "react";
import { formatCalendarDate } from "@/domain/formatting/date";
import type { SupportedLocale } from "@/domain/i18n";
import {
  groupWeeklyHours,
  upcomingExceptions,
  type DayKey,
  type HoursException,
  type WeeklyHours,
} from "@/domain/opening-hours";
import { DEFAULT_TIMEZONE, getZonedDay } from "@/domain/timezone";
import { useZonedToday } from "@/components/time/business-timezone";
import { cn } from "@/lib/utils";

const WEEKDAY_TO_DAY_KEY: readonly DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export interface HoursSummaryLabels {
  closed: string;
  emptyTitle?: string;
  emptyHint?: string;
  legacyTextLabel?: string;
  upcomingExceptionsTitle?: string;
  todayBadge?: string;
}

export interface HoursSummaryProps {
  weekly: WeeklyHours | null;
  exceptions?: readonly HoursException[];
  locale: SupportedLocale;
  labels: HoursSummaryLabels;
  showExceptions?: boolean;
  /** Business IANA timezone for filtering upcoming exceptions & highlighting today. */
  timeZone?: string;
  /** Optional request-time clock instant (avoids waiting for client mount on dynamic pages). */
  now?: Date;
  /** Legacy free-text schedule shown when `weekly` is null. */
  fallbackText?: string | null;
  /** Optional cap on upcoming exceptions displayed. */
  maxExceptions?: number;
  /** Highlight the row containing today's weekday with `labels.todayBadge`. */
  highlightToday?: boolean;
  className?: string;
  "data-testid"?: string;
}

function capitalizeLabel(label: string, locale: SupportedLocale): string {
  if (!label) return label;
  return label[0].toLocaleUpperCase(locale) + label.slice(1);
}

function formatExceptionDate(ex: HoursException, locale: SupportedLocale): string {
  const start = formatCalendarDate(ex.from, locale, "medium");
  if (ex.from === ex.to) return start;
  const end = formatCalendarDate(ex.to, locale, "medium");
  return `${start} – ${end}`;
}

function formatExceptionRanges(ex: HoursException, closedLabel: string): string {
  if (ex.ranges.length === 0) return closedLabel;
  return ex.ranges.map((range) => `${range.open}–${range.close}`).join(" · ");
}

/**
 * Compact, read-only summary of structured weekly opening hours and upcoming exceptions (#372, #375).
 * Prop-driven and free of settings/page-data imports so manager settings, customer storefront, and
 * pickup locations can all reuse it.
 */
export function HoursSummary({
  weekly,
  exceptions,
  locale,
  labels,
  showExceptions = true,
  timeZone = DEFAULT_TIMEZONE,
  now,
  fallbackText,
  maxExceptions,
  highlightToday = false,
  className,
  "data-testid": testId = "hours-summary",
}: HoursSummaryProps) {
  const clientToday = useZonedToday(timeZone);
  const todayIso = now ? getZonedDay(now, timeZone) : clientToday;
  const todayDayKey: DayKey | null =
    highlightToday && todayIso
      ? (WEEKDAY_TO_DAY_KEY[new Date(`${todayIso}T12:00:00Z`).getUTCDay()] ?? null)
      : null;

  const grouped = weekly ? groupWeeklyHours(weekly, locale) : null;

  const upcoming =
    showExceptions && exceptions && exceptions.length > 0
      ? now
        ? upcomingExceptions(exceptions, timeZone, now, maxExceptions)
        : clientToday
          ? upcomingExceptions(
              exceptions,
              "UTC",
              new Date(`${clientToday}T12:00:00Z`),
              maxExceptions,
            )
          : []
      : [];

  const trimmedFallback = fallbackText?.trim() || null;

  return (
    <div className={cn("flex flex-col", className)} data-testid={testId}>
      {grouped ? (
        <ul className="divide-border/50 divide-y" data-testid={`${testId}-weekly`}>
          {grouped.map((group) => {
            const isToday = Boolean(todayDayKey && group.days.includes(todayDayKey));
            const isClosedDisplay = group.closed || group.ranges.length === 0;

            return (
              <li
                key={group.days.join("-")}
                data-testid={`${testId}-row-${group.days[0]}`}
                className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "text-body-sm",
                      isToday ? "text-foreground font-semibold" : "text-foreground",
                    )}
                  >
                    {capitalizeLabel(group.label, locale)}
                  </span>
                  {isToday && labels.todayBadge && (
                    <span
                      data-testid={`${testId}-today-badge`}
                      className="bg-primary text-primary-foreground text-micro rounded px-1.5 py-0.5 font-semibold"
                    >
                      {labels.todayBadge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-body-sm text-right tabular-nums",
                    isClosedDisplay
                      ? "text-muted-foreground"
                      : isToday
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground",
                  )}
                >
                  {isClosedDisplay
                    ? labels.closed
                    : group.ranges.map((range, idx) => (
                        <Fragment key={range}>
                          {idx > 0 && " · "}
                          <span className="whitespace-nowrap">{range}</span>
                        </Fragment>
                      ))}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-1" data-testid={`${testId}-empty`}>
          {trimmedFallback ? (
            <>
              {labels.legacyTextLabel && (
                <p className="text-label-sm text-muted-foreground">{labels.legacyTextLabel}</p>
              )}
              <p
                className="text-body-sm text-foreground font-medium"
                data-testid={`${testId}-fallback`}
              >
                {trimmedFallback}
              </p>
              {labels.emptyHint && (
                <p className="text-body-sm text-muted-foreground pt-1">{labels.emptyHint}</p>
              )}
            </>
          ) : (
            <>
              {labels.emptyTitle && (
                <p className="text-label-md text-foreground">{labels.emptyTitle}</p>
              )}
              {labels.emptyHint && (
                <p className="text-body-sm text-muted-foreground">{labels.emptyHint}</p>
              )}
            </>
          )}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="border-border mt-3 border-t pt-3" data-testid={`${testId}-exceptions`}>
          {labels.upcomingExceptionsTitle && (
            <p className="text-label-sm text-muted-foreground mb-2 tracking-wider uppercase">
              {labels.upcomingExceptionsTitle}
            </p>
          )}
          <ul className="space-y-2">
            {upcoming.map((ex) => {
              const isClosed = ex.ranges.length === 0;
              const note = ex.note?.trim();
              return (
                <li
                  key={`${ex.from}-${ex.to}`}
                  data-testid={`${testId}-exception-${ex.from}`}
                  className="flex flex-col gap-0.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body-sm text-foreground font-medium tabular-nums">
                      {formatExceptionDate(ex, locale)}
                    </span>
                    <span
                      className={cn(
                        "text-body-sm shrink-0 text-right tabular-nums",
                        isClosed
                          ? "bg-warning-soft text-warning-soft-foreground rounded px-1.5 py-0.5 text-xs font-semibold"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatExceptionRanges(ex, labels.closed)}
                    </span>
                  </div>
                  {note && <p className="text-body-sm text-muted-foreground">{note}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
