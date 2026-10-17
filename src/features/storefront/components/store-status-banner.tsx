import { Clock } from "lucide-react";
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
  openingHoursText,
  dict,
}: StoreStatusBannerProps) {
  const isStoreOpen = isAcceptingOrders && isOpen;

  // Extract times if openingHoursText has "HH:MM - HH:MM"
  let openTime = "07:30";
  let closeTime = "19:30";
  if (openingHoursText) {
    const timeMatch = openingHoursText.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
    if (timeMatch) {
      openTime = timeMatch[1];
      closeTime = timeMatch[2];
    }
  }

  const role = !isAcceptingOrders ? "alert" : "status";

  return (
    <section
      role={role}
      aria-live="polite"
      className="border-border/80 bg-card mb-4 flex flex-col gap-2.5 rounded-lg border p-3.5 transition-colors"
    >
      {/* Screen-reader announcements for operational conditions */}
      {!isAcceptingOrders && (
        <div className="sr-only">
          <span>{dict.notAcceptingOrdersBanner}</span>
          <span>{openingHoursText}</span>
        </div>
      )}
      {!isStoreOpen && isAcceptingOrders && (
        <div className="sr-only">
          <span>{dict.storeClosedBadge}</span>
          <span>{dict.storeClosedBanner}</span>
          <span>{dict.scheduledOnlyNotice}</span>
        </div>
      )}
      {isStoreOpen && (
        <div className="sr-only">
          <span>{dict.storeOpenBadge}</span>
          <span>{openingHoursText}</span>
        </div>
      )}

      {/* Row 1: Status indicator & Closing / Opening time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {isStoreOpen ? (
              <>
                <span className="bg-primary/75 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full" />
              </>
            ) : (
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
            )}
          </span>
          <span className="text-foreground text-xs font-bold tracking-tight">
            {isStoreOpen ? dict.openAcceptingOrders : dict.closedOrdersQueued}
          </span>
        </div>
        <span className="text-muted-foreground text-[11px] font-medium tabular-nums">
          {isStoreOpen ? `${dict.closesAt} ${closeTime}` : `${dict.opensAt} ${openTime}`}
        </span>
      </div>

      {/* Row 2: Order ready timing & Fulfillment badge */}
      <div className="border-border/60 text-muted-foreground flex items-center justify-between border-t pt-1.5 text-xs">
        <div className="flex items-center gap-1.5">
          <Clock className="text-primary h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">{dict.orderReadyTime}</span>
        </div>
        <span className="border-border/50 bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium">
          {dict.pickupAndDelivery}
        </span>
      </div>
    </section>
  );
}
