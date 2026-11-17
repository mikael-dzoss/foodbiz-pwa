"use client";

import { useRef, useState } from "react";
import { Clock, Info } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { BusinessSettings } from "@/domain/business";
import { formatLeadTime, getLeadTime } from "@/domain/lead-time";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { useToastOptional } from "@/components/ui";
import {
  useCartOptional,
  resolveServiceMode,
  type StorefrontServiceMode,
} from "../context/cart-context";
import { OrderingDetailsDialog } from "./ordering-details-dialog";

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
        Partial<Pick<BusinessSettings, "leadTimeValue" | "leadTimeUnit">>)
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
  const deliveryBtnRef = useRef<HTMLButtonElement>(null);
  const pickupBtnRef = useRef<HTMLButtonElement>(null);
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
  const isStoreOpen = isAcceptingOrders && isOpen;
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
  if (openingHoursText) {
    const timeMatch = openingHoursText.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      openTime = timeMatch[1];
      closeTime = timeMatch[2];
    }
  }

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

  const handleKeyDown = (e: React.KeyboardEvent, current: StorefrontServiceMode) => {
    if (
      e.key === "ArrowRight" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowUp"
    ) {
      e.preventDefault();
      const nextMode: StorefrontServiceMode = current === "delivery" ? "pickup" : "delivery";
      if (nextMode === "delivery") {
        deliveryBtnRef.current?.focus();
      } else {
        pickupBtnRef.current?.focus();
      }
      handleSelectMode(nextMode);
    }
  };

  return (
    <section data-testid="service-toggle-header" className="mb-4 flex flex-col gap-3">
      {/* Row 1: Segmented Delivery | Pickup toggle + Readiness badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label={dict.fulfillmentMode}
          data-testid="service-mode-toggle"
          className="border-border bg-muted inline-flex items-center rounded-full border p-0.5"
        >
          <button
            ref={deliveryBtnRef}
            type="button"
            role="radio"
            aria-checked={activeMode === "delivery"}
            aria-disabled={!deliveryEnabled || undefined}
            data-testid="service-mode-delivery"
            onClick={() => handleSelectMode("delivery")}
            onKeyDown={(e) => handleKeyDown(e, "delivery")}
            className={`focus-visible:ring-ring min-h-8 min-w-11 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none ${
              activeMode === "delivery"
                ? "bg-primary text-primary-foreground"
                : !deliveryEnabled
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {dict.deliveryToggleLabel}
          </button>

          <button
            ref={pickupBtnRef}
            type="button"
            role="radio"
            aria-checked={activeMode === "pickup"}
            aria-disabled={!pickupEnabled || undefined}
            data-testid="service-mode-pickup"
            onClick={() => handleSelectMode("pickup")}
            onKeyDown={(e) => handleKeyDown(e, "pickup")}
            className={`focus-visible:ring-ring min-h-8 min-w-11 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none ${
              activeMode === "pickup"
                ? "bg-primary text-primary-foreground"
                : !pickupEnabled
                  ? "text-muted-foreground cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {dict.pickupToggleLabel}
          </button>
        </div>

        <button
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
        </button>
      </div>

      {/* Row 2: Bordered 2-tile card (Service fee/address | Store status) */}
      <div
        role={!isAcceptingOrders ? "alert" : "status"}
        aria-live="polite"
        data-testid="service-status-card"
        className="border-border bg-card divide-border grid grid-cols-2 divide-x rounded-xl border p-1.5"
      >
        {/* Left tile */}
        <button
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
        </button>

        {/* Right tile */}
        <button
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
              <span className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                {`${dict.closesAt} ${closeTime}`}
              </span>
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
              <span className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                {`${dict.opensAt} ${openTime}`}
              </span>
              {orderTimingScheduled && (
                <span className="text-muted-foreground text-caption mt-0.5 leading-snug">
                  {dict.storeClosedBanner}
                </span>
              )}
              <span className="sr-only">{dict.scheduledOnlyNotice}</span>
            </>
          )}
        </button>
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
              ? `${dict.storeOpenBadge} · ${dict.closesAt} ${closeTime}`
              : `${dict.storeClosedBadge} · ${dict.opensAt} ${openTime}`
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
