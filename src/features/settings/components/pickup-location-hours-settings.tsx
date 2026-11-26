"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { WeeklyHours } from "@/domain/opening-hours";
import { getDictionary, type SupportedLocale } from "@/domain/i18n";
import { updatePickupLocationAction } from "../pickup-location-actions";
import { RegularHoursForm, type RegularHoursFormLabels } from "./opening-hours";

export interface PickupLocationHoursSettingsProps {
  locationId: string;
  locationName: string;
  /** The location's own hours, or `null` when it follows the shop hours. */
  initial: WeeklyHours | null;
  locale: SupportedLocale;
}

/**
 * Pickup location hours sub-page (#385): the same `RegularHoursForm` as the business page, bound
 * to the location update action. No holidays row (shop closures apply to every pickup point);
 * "clear" stores `null`, meaning the location follows the shop hours.
 */
export function PickupLocationHoursSettings({
  locationId,
  locationName,
  initial,
  locale,
}: PickupLocationHoursSettingsProps) {
  const dict = getDictionary(locale);
  const oh = dict.settings.openingHours;
  const t = dict.settings.pickupLocations;

  const labels: RegularHoursFormLabels = {
    saveButton: oh.saveButton,
    saving: dict.settings.saving,
    discardButton: oh.discardButton,
    discardedToast: dict.settingsExtra.discarded,
    saveSuccess: oh.saveSuccess,
    errorFixBeforeSave: oh.errorFixBeforeSave,
    clearButton: t.clearButton,
    clearConfirmTitle: t.clearConfirmTitle,
    clearConfirmDescription: t.clearConfirmDescription,
    clearConfirmAction: t.clearConfirmAction,
    clearCancelAction: dict.common.cancel,
    clearSuccess: t.clearSuccess,
  };

  return (
    <div
      className="mx-auto w-full max-w-md px-4 py-6 pb-32"
      data-testid="pickup-location-hours-settings"
    >
      <div className="mb-6 flex items-center">
        <Link
          href="/manage/settings/pickup-locations"
          data-testid="back-to-pickup-locations"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          <span>{t.backToLocations}</span>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{t.hoursTitle}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{locationName}</p>
        <p className="text-body-sm text-muted-foreground mt-1">{t.hoursDescription}</p>
      </div>

      <RegularHoursForm
        initial={initial}
        locale={locale}
        labels={labels}
        footerNote={t.hoursFooterNote}
        onSave={(weeklyHours) => updatePickupLocationAction({ id: locationId, weeklyHours })}
        onClear={() => updatePickupLocationAction({ id: locationId, weeklyHours: null })}
      />
    </div>
  );
}
