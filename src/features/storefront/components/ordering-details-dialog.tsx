"use client";

import { Clock, Hourglass, ShoppingBasket, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import type { OpeningSchedule } from "@/domain/opening-hours";
import type { StorefrontPickupLocation } from "@/domain/pickup-location";
import { PickupLocationPicker } from "./pickup-location-picker";

const EMPTY_SCHEDULE: OpeningSchedule = { weekly: null, exceptions: [] };
const EMPTY_LOCATIONS: readonly StorefrontPickupLocation[] = [];
const NOOP = () => {};

export interface OrderingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "delivery" | "pickup";
  deliveryFeeText: string;
  minOrderText: string | null;
  businessName?: string | null;
  pickupAddress?: string | null;
  shopPickupEnabled?: boolean;
  pickupLocations?: readonly StorefrontPickupLocation[];
  businessSchedule?: OpeningSchedule;
  openingHoursText?: string | null;
  selectedPickupChoice?: string | null;
  onSelectPickupLocation?: (choice: string) => void;
  hoursText?: string | null;
  statusText: string;
  isOpenNow: boolean;
  leadTimeText: string;
  locale?: SupportedLocale;
  dict: StorefrontDictionary;
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="border-border bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="text-foreground text-sm font-medium tabular-nums">{children}</div>
      </div>
    </li>
  );
}

export function OrderingDetailsDialog({
  open,
  onOpenChange,
  mode,
  deliveryFeeText,
  minOrderText,
  businessName,
  pickupAddress,
  shopPickupEnabled = true,
  pickupLocations = EMPTY_LOCATIONS,
  businessSchedule = EMPTY_SCHEDULE,
  openingHoursText,
  selectedPickupChoice = null,
  onSelectPickupLocation = NOOP,
  hoursText,
  statusText,
  isOpenNow,
  leadTimeText,
  locale = "en",
  dict,
}: OrderingDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={dict.dismiss}
        data-testid="ordering-details-dialog"
        className="animate-pop-in w-screen-gutter max-h-dvh max-w-sm gap-4 overflow-y-auto overscroll-none rounded-2xl p-5"
      >
        <DialogTitle className="pr-10">{dict.orderingDetailsTitle}</DialogTitle>
        <DialogDescription className="sr-only">{dict.orderingDetailsOpen}</DialogDescription>

        {mode === "pickup" && (
          <PickupLocationPicker
            shopPickupEnabled={shopPickupEnabled}
            pickupLocations={pickupLocations}
            businessName={businessName}
            businessAddress={pickupAddress}
            businessSchedule={businessSchedule}
            openingHoursText={openingHoursText ?? hoursText}
            selectedChoice={selectedPickupChoice}
            onSelect={onSelectPickupLocation}
            locale={locale}
            dict={dict}
            label={dict.pickupLocationSectionTitle}
            data-testid="ordering-details-pickup-picker"
          />
        )}

        <ul className="flex flex-col gap-3">
          {mode === "delivery" && (
            <>
              <DetailRow icon={<Truck className="h-4 w-4" />} label={dict.detailsDeliveryFee}>
                {deliveryFeeText}
              </DetailRow>
              <DetailRow icon={<ShoppingBasket className="h-4 w-4" />} label={dict.detailsMinOrder}>
                {minOrderText ?? dict.detailsNoMinimum}
              </DetailRow>
            </>
          )}
          <DetailRow icon={<Clock className="h-4 w-4" />} label={dict.detailsHours}>
            <span className="flex flex-wrap items-center gap-2">
              {hoursText && <span>{hoursText}</span>}
              <span
                data-testid="ordering-details-status"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isOpenNow ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isOpenNow ? "bg-primary" : "bg-secondary"}`}
                  aria-hidden="true"
                />
                {statusText}
              </span>
            </span>
          </DetailRow>
          <DetailRow icon={<Hourglass className="h-4 w-4" />} label={dict.detailsLeadTime}>
            {leadTimeText}
          </DetailRow>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
