"use client";

import { useMemo, useState } from "react";
import { Clock, Info } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { BusinessSettings } from "@/domain/business";
import { formatLeadTime, getLeadTime } from "@/domain/lead-time";
import { interpolate, type StorefrontDictionary, type SupportedLocale } from "@/domain/i18n";
import type { OpeningSchedule } from "@/domain/opening-hours";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { SegmentedControl, useToastOptional } from "@/components/ui";
import {
  useCartOptional,
  resolveServiceMode,
  type StorefrontServiceMode,
} from "../context/cart-context";
import { useOpenNowStatus } from "../use-is-open-now";
import { OrderingDetailsDialog } from "./ordering-details-dialog";
import { Button } from "@/components/ui/button";

export interface ServiceToggleHeaderProps {
  isAcceptingOrders: boolean;
  isOpen: boolean;
  orderTimingScheduled?: boolean;
  openingHoursText?: string | null;
  businessAddress?: string | null;
  settings?:
    | (Pick<
        BusinessSettings,
        "serviceTypes" | "deliveryFee" | "minOrderAmount" | "orderTimingScheduled"
      > &
        Partial<
          Pick<
            BusinessSettings,
            "leadTimeValue" | "leadTimeUnit" | "weeklyHours" | "hoursExceptions" | "timezone"
          >
        >)
    | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function ServiceToggleHeader({
  isAcceptingOrders,
  isOpen,
  orderTimingScheduled = true,
  openingHoursText,
  businessAddress,
  settings,
  locale,
  dict,
}: ServiceToggleHeaderProps) {
  const cart = useCartOptional();
  const toast = useToastOptional();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const deliveryEnabled = settings?.serviceTypes?.delivery ?? true;
  const pickupEnabled = settings?.serviceTypes?.pickup ?? true;

  const storedMode = cart?.serviceMode ?? "delivery";
  const activeMode = resolveServiceMode(storedMode, {
    delivery: deliveryEnabled,
    pickup: pickupEnabled,
  });

  const deliveryFee = settings?.deliveryFee ?? 0;
  const minOrderAmount = settings?.minOrderAmount ?? 0;
  // Structured hours (#372) are evaluated on the client clock; `isOpen` (cached) is the fallback
  // for free-text hours and the neutral state before hydration.
  const hasStructuredHours =
    Boolean(settings?.weeklyHours) || (settings?.hoursExceptions?.length ?? 0) > 0;
  const timeZone = settings?.timezone ?? DEFAULT_TIMEZONE;
  const schedule = useMemo<OpeningSchedule>(
    () => ({ weekly: settings?.weeklyHours ?? null, exceptions: settings?.hoursExceptions ?? [] }),
    [settings?.weeklyHours, settings?.hoursExceptions],
  );
  const openNow = useOpenNowStatus(schedule, timeZone);
  const structuredStatus = hasStructuredHours ? openNow : null;
  const isStoreOpen = isAcceptingOrders && (structuredStatus ? structuredStatus.isOpen : isOpen);
  const leadTimeText = formatLeadTime(getLeadTime(settings), locale);
  const deliveryFeeText =
    deliveryFee > 0
      ? dict.deliveryFeeShort.replace("{amount}", formatMoney(deliveryFee, locale))
      : dict.freeDelivery;
  const minOrderText =
    minOrderAmount > 0
      ? dict.minOrderShort.replace("{amount}", formatMoney(minOrderAmount, locale))
      : null;

  let openTime = "07:30";
  let closeTime = "19:30";
  if (structuredStatus) {
    if (structuredStatus.closesAt) closeTime = structuredStatus.closesAt;
  } else if (!hasStructuredHours && openingHoursText) {
    const timeMatch = openingHoursText.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      openTime = timeMatch[1];
      closeTime = timeMatch[2];
    }
  }

  let opensText = `${dict.opensAt} ${openTime}`;
  if (structuredStatus?.next) {
    const { date, time } = structuredStatus.next;
    opensText =
      date === structuredStatus.today
        ? `${dict.opensAt} ${time}`
        : interpolate(dict.opensOnDayAt, {
            day: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
              new Date(`${date}T12:00:00Z`),
            ),
            time,
          });
  } else if (structuredStatus) {
    opensText = "";
  }
  const closesText =
    structuredStatus && !structuredStatus.closesAt ? "" : `${dict.closesAt} ${closeTime}`;

  const handleSelectMode = (targetMode: StorefrontServiceMode) => {
    const isTargetEnabled = targetMode === "delivery" ? deliveryEnabled : pickupEnabled;
    if (!isTargetEnabled) {
      toast?.showToast(
        targetMode === "pickup" ? dict.pickupUnavailableToast : dict.deliveryUnavailableToast,
      );
      return;
    }
    cart?.setServiceMode(targetMode);
  };

  return (
    <section data-testid="service-toggle-header" className="mb-4 flex flex-col gap-3">
      {/* Row 1: Segmented Delivery | Pickup toggle + Readiness badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* 32px segments are an owner-approved exception (#227): they match the readiness badge. */}
        <SegmentedControl
          aria-label={dict.fulfillmentMode}
          data-testid="service-mode-toggle"
          value={activeMode}
          onValueChange={handleSelectMode}
          className="border-border bg-muted inline-flex items-center gap-0 rounded-full border p-0.5"
          optionClassName="min-h-8 min-w-11 flex-none rounded-full px-3 py-1 text-xs font-semibold duration-150"
          selectedClassName="bg-primary text-primary-foreground"
          options={[
            {
              value: "delivery",
              label: dict.deliveryToggleLabel,
              unavailable: !deliveryEnabled,
              "data-testid": "service-mode-delivery",
            },
            {
              value: "pickup",
              label: dict.pickupToggleLabel,
              unavailable: !pickupEnabled,
              "data-testid": "service-mode-pickup",
            },
          ]}
        />

        <Button
          variant="unstyled"
          size="none"
          type="button"
          data-testid="readiness-badge"
          aria-haspopup="dialog"
          onClick={() => setDetailsOpen(true)}
          className="border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-9.5 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none"
        >
          <Clock className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            {dict.orderReadyTime.replace("{leadTime}", leadTimeText)}
          </span>
          <span className="sr-only">{` – ${dict.orderingDetailsOpen}`}</span>
        </Button>
      </div>

      {/* Row 2: Bordered 2-tile card (Service fee/address | Store status) */}
      <div
        role={!isAcceptingOrders ? "alert" : "status"}
        aria-live="polite"
        data-testid="service-status-card"
        className="border-border bg-card divide-border grid grid-cols-2 divide-x rounded-xl border p-1.5"
      >
        {/* Left tile */}
        <Button
          variant="unstyled"
          size="none"
          type="button"
          data-testid="service-info-tile"
          aria-haspopup="dialog"
          onClick={() => setDetailsOpen(true)}
          className="group hover:bg-muted/50 focus-visible:ring-ring flex min-h-14 flex-col items-center justify-center rounded-lg px-2 py-1 text-center transition-colors focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none"
        >
          {activeMode === "delivery" ? (
            <>
              <span className="text-foreground text-label-strong inline-flex items-center gap-1 font-semibold tabular-nums">
                {deliveryFeeText}
                <InfoGlyph label={dict.orderingDetailsOpen} />
              </span>
              {minOrderText && (
                <span className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  {minOrderText}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-foreground text-label-strong inline-flex items-center gap-1 font-semibold">
                {dict.noFees}
                <InfoGlyph label={dict.orderingDetailsOpen} />
              </span>
              {businessAddress && (
                <span className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                  {businessAddress}
                </span>
              )}
            </>
          )}
        </Button>

        {/* Right tile */}
        <Button
          variant="unstyled"
          size="none"
          type="button"
          data-testid="store-status-tile"
          aria-haspopup="dialog"
          onClick={() => setDetailsOpen(true)}
          className="group hover:bg-muted/50 focus-visible:ring-ring flex min-h-14 flex-col items-center justify-center rounded-lg px-2 py-1 text-center transition-colors focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none"
        >
          {!isAcceptingOrders ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="bg-destructive h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                <span className="text-foreground text-label-strong font-semibold">
                  {dict.notAcceptingOrdersShort}
                </span>
                <InfoGlyph label={dict.orderingDetailsOpen} />
              </span>
              <span className="text-muted-foreground mt-0.5 text-xs">
                {dict.notAcceptingOrdersBanner}
              </span>
              {openingHoursText && <span className="sr-only">{openingHoursText}</span>}
            </>
          ) : isStoreOpen ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="bg-primary h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                <span className="text-foreground text-label-strong font-semibold">
                  {dict.storeOpenBadge}
                </span>
                <InfoGlyph label={dict.orderingDetailsOpen} />
              </span>
              {closesText && (
                <span className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  {closesText}
                </span>
              )}
              {openingHoursText && <span className="sr-only">{openingHoursText}</span>}
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="bg-secondary h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                <span className="text-foreground text-label-strong font-semibold">
                  {dict.storeClosedBadge}
                </span>
                <InfoGlyph label={dict.orderingDetailsOpen} />
              </span>
              {opensText && (
                <span className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  {opensText}
                </span>
              )}
              {orderTimingScheduled && (
                <span className="text-muted-foreground text-caption mt-0.5 leading-snug">
                  {dict.storeClosedBanner}
                </span>
              )}
              <span className="sr-only">{dict.scheduledOnlyNotice}</span>
            </>
          )}
        </Button>
      </div>

      <OrderingDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        mode={activeMode}
        deliveryFeeText={deliveryFee > 0 ? formatMoney(deliveryFee, locale) : dict.freeDelivery}
        minOrderText={minOrderAmount > 0 ? formatMoney(minOrderAmount, locale) : null}
        pickupAddress={businessAddress}
        hoursText={openingHoursText}
        statusText={
          !isAcceptingOrders
            ? dict.notAcceptingOrdersShort
            : isStoreOpen
              ? [dict.storeOpenBadge, closesText].filter(Boolean).join(" · ")
              : [dict.storeClosedBadge, opensText].filter(Boolean).join(" · ")
        }
        isOpenNow={isStoreOpen}
        leadTimeText={leadTimeText}
        dict={dict}
      />
    </section>
  );
}

function InfoGlyph({ label }: { label: string }) {
  return (
    <Info
      className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 shrink-0"
      aria-label={label}
      role="img"
    />
  );
}
