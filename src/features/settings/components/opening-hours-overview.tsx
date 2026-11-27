import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import { getDictionary, type SupportedLocale } from "@/domain/i18n";
import { interpolate } from "@/domain/i18n";
import { upcomingExceptions } from "@/domain/opening-hours";
import { HoursSummary } from "./opening-hours";

export interface OpeningHoursOverviewProps {
  settings: BusinessSettings;
  locale: SupportedLocale;
  /** Request-time clock so upcoming exceptions render on the server without a layout shift. */
  now: Date;
}

/** Opening hours overview (#372): read-only summary plus links to the editing sub-pages. */
export function OpeningHoursOverview({ settings, locale, now }: OpeningHoursOverviewProps) {
  const dict = getDictionary(locale).settings;
  const oh = dict.openingHours;
  const configured = settings.weeklyHours != null;
  const ex = dict.hoursExceptions;
  const upcomingCount = upcomingExceptions(
    settings.hoursExceptions ?? [],
    settings.timezone,
    now,
  ).length;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-24" data-testid="opening-hours-overview">
      <div className="mb-6 flex items-center">
        <Link
          href="/manage/settings"
          data-testid="back-to-settings"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          <span>{dict.title}</span>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{oh.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{oh.description}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {oh.overviewSummarySection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-2xs">
          <HoursSummary
            weekly={settings.weeklyHours ?? null}
            exceptions={settings.hoursExceptions}
            locale={locale}
            timeZone={settings.timezone}
            now={now}
            fallbackText={settings.openingHours}
            maxExceptions={5}
            labels={{
              closed: oh.closed,
              emptyTitle: oh.emptyTitle,
              emptyHint: oh.emptyHint,
              legacyTextLabel: oh.legacyTextLabel,
              upcomingExceptionsTitle: oh.upcomingExceptionsTitle,
            }}
          />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {oh.optionsSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-2xs">
          <Link
            href="/manage/settings/opening-hours/regular"
            data-testid="link-regular-hours"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-label-md text-foreground block">{oh.regularTitle}</span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {configured ? oh.regularConfigured : oh.regularNotSet}
                </span>
              </div>
            </div>
            <ChevronRight
              className="text-muted-foreground/60 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
          </Link>
          <Link
            href="/manage/settings/opening-hours/exceptions"
            data-testid="link-exceptions"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <CalendarOff className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-label-md text-foreground block">{ex.title}</span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {upcomingCount > 0
                    ? interpolate(ex.rowUpcoming, { count: upcomingCount })
                    : ex.rowNone}
                </span>
              </div>
            </div>
            <ChevronRight
              className="text-muted-foreground/60 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
