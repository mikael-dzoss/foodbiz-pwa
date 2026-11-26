import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import { getDictionary, type SupportedLocale } from "@/domain/i18n";
import { HoursSummary } from "./opening-hours";

export interface OpeningHoursOverviewProps {
  settings: BusinessSettings;
  locale: SupportedLocale;
}

/** Opening hours overview (#372): read-only summary plus links to the editing sub-pages. */
export function OpeningHoursOverview({ settings, locale }: OpeningHoursOverviewProps) {
  const dict = getDictionary(locale).settings;
  const oh = dict.openingHours;
  const configured = settings.weeklyHours != null;

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
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          <Link
            href="/manage/settings/opening-hours/regular"
            data-testid="link-regular-hours"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 items-center justify-between gap-3 rounded-2xl p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {oh.regularTitle}
                </span>
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
        </div>
      </div>
    </div>
  );
}
