"use client";

import { Clock, Hourglass, MapPin, ShoppingBasket, Truck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { StorefrontDictionary } from "@/domain/i18n";

export interface OrderingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "delivery" | "pickup";
  deliveryFeeText: string;
  minOrderText: string | null;
  pickupAddress?: string | null;
  hoursText?: string | null;
  statusText: string;
  isOpenNow: boolean;
  leadTimeText: string;
  leadTimeNote: string | null;
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
  pickupAddress,
  hoursText,
  statusText,
  isOpenNow,
  leadTimeText,
  leadTimeNote,
  dict,
}: OrderingDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="ordering-details-dialog"
        className="animate-pop-in w-[calc(100%-2rem)] max-w-sm gap-4 rounded-2xl p-5"
      >
        <DialogTitle className="pr-10">{dict.orderingDetailsTitle}</DialogTitle>
        <DialogDescription className="sr-only">{dict.orderingDetailsOpen}</DialogDescription>
        <ul className="flex flex-col gap-3">
          {mode === "delivery" ? (
            <>
              <DetailRow icon={<Truck className="h-4 w-4" />} label={dict.detailsDeliveryFee}>
                {deliveryFeeText}
              </DetailRow>
              <DetailRow icon={<ShoppingBasket className="h-4 w-4" />} label={dict.detailsMinOrder}>
                {minOrderText ?? dict.detailsNoMinimum}
              </DetailRow>
            </>
          ) : (
            pickupAddress && (
              <DetailRow icon={<MapPin className="h-4 w-4" />} label={dict.detailsPickupAddress}>
                {pickupAddress}
              </DetailRow>
            )
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
        {leadTimeNote && (
          <p
            data-testid="ordering-details-note"
            className="border-border bg-muted/60 text-muted-foreground flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{leadTimeNote}</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
