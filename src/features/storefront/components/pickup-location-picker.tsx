"use client";

import { useId, useMemo, useState, type RefCallback } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Clock, MapPin, Store } from "lucide-react";
import { interpolate, type StorefrontDictionary, type SupportedLocale } from "@/domain/i18n";
import type { OpeningSchedule } from "@/domain/opening-hours";
import type { StorefrontPickupLocation } from "@/domain/pickup-location";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buildPickupOptionItems,
  formatPickupFee,
  PICKUP_COLLAPSED_LIMIT,
  type PickupOptionItem,
} from "../pickup-options";

export interface PickupLocationPickerProps {
  shopPickupEnabled: boolean;
  pickupLocations: readonly StorefrontPickupLocation[];
  businessName?: string | null;
  businessAddress?: string | null;
  businessSchedule: OpeningSchedule;
  openingHoursText?: string | null;
  selectedChoice: string | null;
  onSelect: (choice: string) => void;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  /** Optional heading override for the legend / section label. */
  label?: string;
  /** Show a prompt below the label when several options exist and none is picked yet. */
  showRequiredPrompt?: boolean;
  /** Inline server/validation error rendered inside the picker (`role="alert"`). */
  error?: string | null;
  /** Optional ref callback to focus or scroll the picker container on error. */
  pickerRef?: RefCallback<HTMLElement>;
  "data-testid"?: string;
}

function OptionDetails({
  option,
  locale,
  dict,
}: {
  option: PickupOptionItem;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}) {
  const feeText = formatPickupFee(option.feeCents, locale, dict.pickupLocationFeeFree);
  const isFree = option.feeCents <= 0;

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <span className="text-label-strong text-foreground flex min-w-0 items-center gap-1.5">
          {option.kind === "shop" ? (
            <Store className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <MapPin className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 wrap-anywhere">{option.name}</span>
        </span>
        <span
          data-testid={`pickup-option-fee-${option.id}`}
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 tabular-nums",
            isFree
              ? "text-label-sm bg-primary-soft text-primary-soft-foreground"
              : "text-label-strong bg-muted text-foreground",
          )}
        >
          {feeText}
        </span>
      </div>

      {option.description && (
        <p className="text-body-sm text-muted-foreground wrap-anywhere">{option.description}</p>
      )}

      {option.addressLine && (
        <p className="text-body-sm text-muted-foreground wrap-anywhere">{option.addressLine}</p>
      )}

      {option.hoursText && (
        <p
          data-testid={`pickup-option-hours-${option.id}`}
          className="text-caption text-muted-foreground flex items-start gap-1.5 tabular-nums"
        >
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere">{option.hoursText}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Storefront pickup location picker shared by the ordering-details dialog and checkout (#386).
 * - 0 options: inline unavailable notice.
 * - 1 option: preselected and rendered read-only.
 * - 2+ options: accessible radio cards (>= 44 px tall), collapsing past 3 behind "Show all".
 */
export function PickupLocationPicker({
  shopPickupEnabled,
  pickupLocations,
  businessName,
  businessAddress,
  businessSchedule,
  openingHoursText,
  selectedChoice,
  onSelect,
  locale,
  dict,
  label,
  showRequiredPrompt = false,
  error = null,
  pickerRef,
  "data-testid": testId = "pickup-location-picker",
}: PickupLocationPickerProps) {
  const groupId = useId();
  const headingId = `${groupId}-heading`;
  const errorId = `${groupId}-error`;
  const groupName = `pickup-location-${groupId}`;

  const options = useMemo(
    () =>
      buildPickupOptionItems({
        shopPickupEnabled,
        pickupLocations,
        businessName,
        businessAddress,
        businessSchedule,
        openingHoursText,
        locale,
        dict,
      }),
    [
      shopPickupEnabled,
      pickupLocations,
      businessName,
      businessAddress,
      businessSchedule,
      openingHoursText,
      locale,
      dict,
    ],
  );

  const selectedIndex = useMemo(
    () => (selectedChoice ? options.findIndex((option) => option.id === selectedChoice) : -1),
    [options, selectedChoice],
  );

  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? selectedIndex >= PICKUP_COLLAPSED_LIMIT;
  const canCollapse = options.length > PICKUP_COLLAPSED_LIMIT;
  const visibleOptions =
    canCollapse && !expanded ? options.slice(0, PICKUP_COLLAPSED_LIMIT) : options;
  const heading = label ?? dict.pickupLocationSectionTitle;

  if (options.length === 0) {
    return (
      <div
        ref={pickerRef}
        tabIndex={-1}
        role={error ? "alert" : "status"}
        data-testid={`${testId}-unavailable`}
        className="border-destructive/30 bg-destructive/10 text-destructive text-body-sm focus-visible:ring-ring flex items-start gap-2 rounded-xl border p-3 focus:outline-hidden focus-visible:ring-2"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span data-testid={error ? `${testId}-error` : undefined} className="min-w-0 wrap-anywhere">
          {error ?? dict.orderErrorPickupNotAvailable}
        </span>
      </div>
    );
  }

  if (options.length === 1) {
    const single = options[0];
    return (
      <div
        ref={pickerRef}
        tabIndex={-1}
        role="group"
        aria-labelledby={headingId}
        aria-describedby={error ? errorId : undefined}
        data-testid={testId}
        className="focus-visible:ring-ring min-w-0 space-y-2 rounded-xl focus:outline-hidden focus-visible:ring-2"
      >
        <p id={headingId} className="text-label-sm text-muted-foreground tracking-wider uppercase">
          {heading}
        </p>
        <div
          data-testid="pickup-location-readonly"
          className={cn(
            "bg-muted/40 flex min-h-11 items-start gap-3 rounded-xl border p-3",
            error ? "border-destructive" : "border-border",
          )}
        >
          <OptionDetails option={single} locale={locale} dict={dict} />
        </div>
        {error && (
          <p
            id={errorId}
            role="alert"
            data-testid={`${testId}-error`}
            className="border-destructive/30 bg-destructive/10 text-destructive text-body-sm flex items-start gap-2 rounded-xl border p-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">{error}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <fieldset
      ref={pickerRef}
      tabIndex={-1}
      aria-describedby={error ? errorId : undefined}
      data-testid={testId}
      className="focus-visible:ring-ring min-w-0 space-y-2 rounded-xl focus:outline-hidden focus-visible:ring-2"
    >
      <legend className="text-label-sm text-muted-foreground tracking-wider uppercase">
        {heading}
        {showRequiredPrompt && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
      </legend>

      {error && (
        <p
          id={errorId}
          role="alert"
          data-testid={`${testId}-error`}
          className="border-destructive/30 bg-destructive/10 text-destructive text-body-sm flex items-start gap-2 rounded-xl border p-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere">{error}</span>
        </p>
      )}

      {showRequiredPrompt && !selectedChoice && !error && (
        <p
          data-testid="pickup-location-choose-prompt"
          className="text-body-sm text-muted-foreground"
        >
          {dict.pickupLocationChoosePrompt}
        </p>
      )}

      <div className="space-y-2">
        {visibleOptions.map((option) => {
          const isSelected = selectedChoice === option.id;
          const inputId = `${groupId}-${option.id}`;
          return (
            <div key={option.id} className="relative">
              <input
                id={inputId}
                type="radio"
                name={groupName}
                value={option.id}
                checked={isSelected}
                onChange={() => onSelect(option.id)}
                aria-describedby={error ? errorId : undefined}
                className="peer sr-only"
                data-testid={`pickup-location-radio-${option.id}`}
              />
              <label
                htmlFor={inputId}
                data-testid={`pickup-location-option-${option.id}`}
                className={cn(
                  "flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 rounded-xl border p-3 transition-colors duration-150 motion-reduce:transition-none",
                  "active:bg-muted/60",
                  "peer-focus-visible:ring-ring peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
                  isSelected
                    ? "border-primary bg-primary/5 ring-primary ring-1"
                    : "border-border bg-card hover:border-input",
                )}
              >
                <span className="pt-0.5" aria-hidden="true">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border-2",
                      isSelected ? "border-primary bg-card" : "border-input",
                    )}
                  >
                    {isSelected && <span className="bg-primary h-2 w-2 rounded-full" />}
                  </span>
                </span>
                <OptionDetails option={option} locale={locale} dict={dict} />
              </label>
            </div>
          );
        })}
      </div>

      {canCollapse && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setUserExpanded(!expanded)}
          data-testid="pickup-locations-toggle"
          className="text-label-sm min-h-9 w-full touch-manipulation rounded-lg"
        >
          {expanded ? (
            <>
              <span>{dict.pickupLocationShowFewer}</span>
              <ChevronUp className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </>
          ) : (
            <>
              <span>
                {interpolate(dict.pickupLocationShowAll, { count: String(options.length) })}
              </span>
              <ChevronDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      )}
    </fieldset>
  );
}
