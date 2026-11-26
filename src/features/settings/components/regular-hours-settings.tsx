"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { WeeklyHours } from "@/domain/opening-hours";
import { getDictionary, type SupportedLocale } from "@/domain/i18n";
import { updateOpeningHoursAction } from "../actions";
import { RegularHoursForm } from "./opening-hours";

export interface RegularHoursSettingsProps {
  initial: WeeklyHours | null;
  locale: SupportedLocale;
}

/** Business regular-hours sub-page (#372): binds the reusable form to the settings action. */
export function RegularHoursSettings({ initial, locale }: RegularHoursSettingsProps) {
  const oh = getDictionary(locale).settings.openingHours;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-32" data-testid="regular-hours-settings">
      <div className="mb-6 flex items-center">
        <Link
          href="/manage/settings/opening-hours"
          data-testid="back-to-opening-hours"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          <span>{oh.title}</span>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{oh.regularTitle}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{oh.regularDescription}</p>
      </div>

      <RegularHoursForm
        initial={initial}
        locale={locale}
        onSave={(weeklyHours) => updateOpeningHoursAction({ weeklyHours })}
        onClear={() => updateOpeningHoursAction({ weeklyHours: null })}
      />
    </div>
  );
}
