"use client";

import { useRef } from "react";
import { Clock } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { BusinessSettings } from "@/domain/business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { useToastOptional } from "@/components/ui";
import {
  useCartOptional,
  resolveServiceMode,
  type StorefrontServiceMode,
} from "../context/cart-context";

export interface ServiceToggleHeaderProps {
  isAcceptingOrders: boolean;
  isOpen: boolean;
  orderTimingScheduled?: boolean;
  openingHoursText?: string | null;
  businessAddress?: string | null;
  settings?: Pick<
    BusinessSettings,
    "serviceTypes" | "deliveryFee" | "minOrderAmount" | "orderTimingScheduled"
  > | null;
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
            className={`focus-visible:ring-ring min-h-11 min-w-11 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none ${
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
            className={`focus-visible:ring-ring min-h-11 min-w-11 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none ${
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

        <div
          data-testid="readiness-badge"
          className="border-border bg-card text-muted-foreground inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
        >
          <Clock className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{dict.orderReadyTime}</span>
        </div>
      </div>

      {/* Row 2: Bordered 2-tile card (Service fee/address | Store status) */}
      <div
        role={!isAcceptingOrders ? "alert" : "status"}
        aria-live="polite"
        data-testid="service-status-card"
        className="border-border bg-card divide-border grid grid-cols-2 divide-x rounded-xl border p-3"
      >
        {/* Left tile */}
        <div data-testid="service-info-tile" className="flex flex-col justify-center pr-3">
          {activeMode === "delivery" ? (
            <>
              <p className="text-foreground text-sm font-bold tabular-nums">
                {deliveryFee > 0
                  ? dict.deliveryFeeShort.replace("{amount}", formatMoney(deliveryFee, locale))
                  : dict.freeDelivery}
              </p>
              {minOrderAmount > 0 && (
                <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  {dict.minOrderShort.replace("{amount}", formatMoney(minOrderAmount, locale))}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-foreground text-sm font-bold">{dict.noFees}</p>
              {businessAddress && (
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{businessAddress}</p>
              )}
            </>
          )}
        </div>

        {/* Right tile */}
        <div data-testid="store-status-tile" className="flex flex-col justify-center pl-3">
          {!isAcceptingOrders ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="bg-destructive h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                <span className="text-foreground text-sm font-bold">
                  {dict.notAcceptingOrdersShort}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {dict.notAcceptingOrdersBanner}
              </p>
              {openingHoursText && <span className="sr-only">{openingHoursText}</span>}
            </>
          ) : isStoreOpen ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="bg-primary h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                <span className="text-foreground text-sm font-bold">{dict.storeOpenBadge}</span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                {`${dict.closesAt} ${closeTime}`}
              </p>
              {openingHoursText && <span className="sr-only">{openingHoursText}</span>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="bg-secondary h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                <span className="text-foreground text-sm font-bold">{dict.storeClosedBadge}</span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                {`${dict.opensAt} ${openTime}`}
              </p>
              {orderTimingScheduled && (
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
                  {dict.storeClosedBanner}
                </p>
              )}
              <span className="sr-only">{dict.scheduledOnlyNotice}</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
