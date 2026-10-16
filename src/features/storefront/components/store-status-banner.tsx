import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import type { StorefrontDictionary } from "@/domain/i18n";

export interface StoreStatusBannerProps {
  isAcceptingOrders: boolean;
  isOpen: boolean;
  orderTimingScheduled?: boolean;
  openingHoursText?: string | null;
  dict: StorefrontDictionary;
}

export function StoreStatusBanner({
  isAcceptingOrders,
  isOpen,
  orderTimingScheduled = true,
  openingHoursText,
  dict,
}: StoreStatusBannerProps) {
  // Case 1: Shop isn't accepting orders (Story #82 AC)
  if (!isAcceptingOrders) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="border-destructive/30 bg-destructive/10 text-destructive mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{dict.notAcceptingOrdersBanner}</span>
          <span className="text-xs opacity-90">
            {dict.contact} {openingHoursText ? `· ${openingHoursText}` : ""}
          </span>
        </div>
      </div>
    );
  }

  // Case 2: Store is closed per opening hours, but accepting scheduled pre-orders (Story #82 AC)
  if (!isOpen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-warning-soft bg-warning-soft/20 text-warning-soft-foreground mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm"
      >
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="bg-warning-soft text-warning-soft-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
              {dict.storeClosedBadge}
            </span>
            <span className="font-semibold">{dict.storeClosedBanner}</span>
          </div>
          {orderTimingScheduled && (
            <span className="text-muted-foreground text-xs">{dict.scheduledOnlyNotice}</span>
          )}
        </div>
      </div>
    );
  }

  // Case 3: Store is open & accepting orders
  return (
    <div className="border-border bg-card mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full" />
        </span>
        <span className="text-foreground font-semibold">{dict.storeOpenBadge}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{openingHoursText ?? dict.openHours}</span>
      </div>
      <div className="text-muted-foreground flex items-center gap-1.5">
        <CheckCircle2 className="text-primary h-3.5 w-3.5" />
        <span>
          {dict.servicePickup} &amp; {dict.serviceDelivery}
        </span>
      </div>
    </div>
  );
}
