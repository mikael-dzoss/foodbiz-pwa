import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Check,
  CheckCircle2,
  ChefHat,
  PackageCheck,
  Store,
  Truck,
  MapPin,
  Phone,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatMoney,
  formatTime,
  publicDeliveryAddress,
  type PublicOrder,
  type OrderStatus,
  type SupportedLocale,
} from "@/domain";
import type { StorefrontBusiness } from "@/domain/storefront-business";
import type { OrderTrackingDictionary, StorefrontDictionary } from "@/domain/i18n";
import { cn } from "@/lib/utils";

export interface OrderTrackingViewProps {
  order: PublicOrder;
  business: StorefrontBusiness;
  locale: SupportedLocale;
  /** Business time zone (IANA): timestamps read the same on server and device. */
  timeZone: string;
  dict: OrderTrackingDictionary;
  storefrontDict?: StorefrontDictionary;
}

interface TimelineStepConfig {
  status: OrderStatus;
  title: string;
  defaultNote: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrderTrackingView({
  order,
  business,
  locale,
  timeZone,
  dict,
}: OrderTrackingViewProps) {
  const isCancelled = order.status === "CANCELLED";
  const isCompleted = order.status === "COMPLETED";
  const isDelivery = order.serviceType === "delivery";
  const deliveryAddress = publicDeliveryAddress(order.serviceType, order.deliveryAddress);

  const cleanPhone = business.phone?.replace(/\D/g, "");
  const mapsUrl =
    !isDelivery && business.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name}, ${business.address}`)}`
      : null;

  // Stepper milestones
  const steps: TimelineStepConfig[] = [
    {
      status: "NEW",
      title: dict.statuses.NEW,
      defaultNote: dict.stepNotes.placed,
      icon: Check,
    },
    {
      status: "CONFIRMED",
      title: dict.statuses.CONFIRMED,
      defaultNote: dict.stepNotes.confirmed,
      icon: CheckCircle2,
    },
    {
      status: "PREPARING",
      title: dict.statuses.PREPARING,
      defaultNote: dict.stepNotes.preparing,
      icon: ChefHat,
    },
    {
      status: "READY",
      title: dict.statuses.READY,
      defaultNote:
        order.serviceType === "pickup" ? dict.stepNotes.readyPickup : dict.stepNotes.readyDelivery,
      icon: PackageCheck,
    },
    {
      status: "COMPLETED",
      title: dict.statuses.COMPLETED,
      defaultNote: dict.stepNotes.completed,
      icon: Check,
    },
  ];

  // Helper to determine state of each stepper node
  const getStepState = (stepStatus: OrderStatus) => {
    if (isCancelled) {
      if (stepStatus === "NEW") return "completed";
      return "skipped";
    }

    const orderRank: Record<OrderStatus, number> = {
      NEW: 0,
      CONFIRMED: 1,
      PREPARING: 2,
      READY: 3,
      COMPLETED: 4,
      CANCELLED: -1,
    };

    const currentRank = orderRank[order.status];
    const targetRank = orderRank[stepStatus];

    if (currentRank > targetRank) return "completed";
    if (currentRank === targetRank) return "active";
    return "upcoming";
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="border-border mx-auto flex min-h-screen max-w-md flex-col border-x pb-12">
        {/* 1. Header / Top App Bar */}
        <header className="bg-card/95 border-border sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur">
          <Link
            href={`/${locale}`}
            aria-label={dict.backToCatalog}
            className="hover:bg-muted text-foreground -ml-1.5 flex h-11 w-11 items-center justify-center rounded-lg transition-colors active:scale-95"
            data-testid="tracking-back-button"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col items-center text-center">
            <h1 className="text-title-md text-foreground">{dict.title}</h1>
            <span className="text-muted-foreground text-xs font-medium">{business.name}</span>
          </div>
          <span className="w-11" aria-hidden="true" />
        </header>

        {/* 2. Main Content */}
        <div className="flex-1 space-y-4 px-4 py-4">
          {/* Hero Order Header Card */}
          <section
            className="bg-card border-border rounded-xl border p-4 shadow-none"
            data-testid="tracking-header-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-muted-foreground text-caption font-bold tracking-wider uppercase">
                  {dict.orderReference}
                </span>
                <div className="mt-0.5 flex items-center gap-2">
                  <h2
                    className="text-title-lg text-foreground tabular-nums"
                    data-testid="tracking-order-title"
                  >
                    {dict.orderLabel} #{order.orderNumber ?? "—"}
                  </h2>
                </div>
                <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                  {dict.placedAt} {formatTime(order.createdAt, timeZone, locale)}
                </p>
              </div>

              {/* Status Badge */}
              <div data-testid="tracking-status-badge">
                {isCancelled ? (
                  <Badge
                    variant="cancelled"
                    className="gap-1 px-2.5 py-1 text-xs font-bold uppercase"
                  >
                    {dict.statuses.CANCELLED}
                  </Badge>
                ) : (
                  <Badge
                    variant={
                      order.status === "NEW"
                        ? "new"
                        : order.status === "CONFIRMED"
                          ? "confirmed"
                          : order.status === "PREPARING"
                            ? "preparing"
                            : order.status === "READY"
                              ? "ready"
                              : "completed"
                    }
                    className="gap-1.5 px-2.5 py-1 text-xs font-semibold capitalize"
                  >
                    <span className="bg-primary h-2 w-2 animate-pulse rounded-full" />
                    <span>{dict.statuses[order.status]}</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Estimated Timing Banner or Cancellation Banner */}
            {isCancelled ? (
              <div
                className="bg-destructive/10 border-destructive/30 mt-4 rounded-lg border p-3.5"
                data-testid="tracking-cancellation-banner"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex flex-col gap-1">
                    <p className="text-destructive text-xs font-bold">{dict.orderCancelledTitle}</p>
                    {order.cancellationReason && (
                      <p
                        className="text-foreground text-xs leading-relaxed"
                        data-testid="tracking-cancellation-reason"
                      >
                        <span className="font-semibold">{dict.rejectionReasonLabel}: </span>
                        <span>&ldquo;{order.cancellationReason}&rdquo;</span>
                      </p>
                    )}
                    <p className="text-muted-foreground text-caption">
                      {dict.cancelledPaymentHelp}
                    </p>
                  </div>
                </div>
              </div>
            ) : !isCompleted ? (
              <div className="bg-muted border-border mt-3 flex items-center gap-3 rounded-lg border p-3">
                <div className="bg-primary-soft text-primary-soft-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-xs font-medium">
                    {order.serviceType === "pickup" ? dict.readyInApprox : dict.deliveryTime}
                  </p>
                  <p className="text-primary text-xs font-bold tabular-nums">
                    {order.requestedDate} · {order.requestedTime ?? dict.asap}
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          {/* 3. Live Order Progress Stepper */}
          <section
            className="bg-card border-border rounded-xl border p-4 shadow-none"
            data-testid="tracking-stepper"
          >
            <div className="border-border/60 mb-4 flex items-center justify-between border-b pb-2.5">
              <h3 className="text-label-sm text-muted-foreground tracking-wider uppercase">
                {dict.liveOrderProgress}
              </h3>
              <span className="text-muted-foreground text-xs">{dict.refreshHint}</span>
            </div>

            {isCancelled ? (
              <div className="before:bg-border relative space-y-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5">
                <div className="relative">
                  <span className="bg-primary text-primary-foreground text-micro absolute top-0 -left-6 flex h-4 w-4 items-center justify-center rounded-full">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <p className="text-foreground text-xs font-bold">{dict.statuses.NEW}</p>
                  <p className="text-muted-foreground text-caption">{dict.stepNotes.placed}</p>
                </div>

                <div className="relative">
                  <span className="bg-destructive text-destructive-foreground text-micro absolute top-0 -left-6 flex h-4 w-4 items-center justify-center rounded-full">
                    <RotateCcw className="h-2.5 w-2.5" />
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-destructive text-xs font-bold">{dict.statuses.CANCELLED}</p>
                    <span className="bg-destructive/10 text-destructive text-micro rounded px-1.5 font-semibold">
                      {dict.currentStatus}
                    </span>
                  </div>
                  {order.cancellationReason && (
                    <p className="text-muted-foreground text-caption mt-0.5">
                      {order.cancellationReason}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <ol className="before:bg-border relative space-y-5 pl-6 before:absolute before:top-2.5 before:bottom-2.5 before:left-2 before:w-0.5">
                {steps.map((step) => {
                  const state = getStepState(step.status);
                  const isCurrent = state === "active";
                  const isDone = state === "completed";

                  return (
                    <li key={step.status} className="relative flex flex-col gap-0.5">
                      {/* Step Indicator Node */}
                      <span
                        className={cn(
                          "absolute top-0.5 -left-6 flex h-4 w-4 items-center justify-center rounded-full",
                          isDone && "bg-primary text-primary-foreground",
                          isCurrent &&
                            "bg-primary ring-primary/30 text-primary-foreground animate-pulse ring-4",
                          state === "upcoming" &&
                            "bg-card border-border text-muted-foreground border",
                        )}
                      >
                        {isDone ? (
                          <Check className="h-2.5 w-2.5 stroke-3" />
                        ) : isCurrent ? (
                          <span className="bg-primary-foreground h-1.5 w-1.5 rounded-full" />
                        ) : (
                          <span className="bg-muted-foreground/40 h-1 w-1 rounded-full" />
                        )}
                      </span>

                      <div className="flex items-baseline justify-between gap-2">
                        <h4
                          className={cn(
                            "text-label-md",
                            isCurrent && "text-primary",
                            isDone && "text-foreground",
                            state === "upcoming" && "text-muted-foreground/75",
                          )}
                        >
                          {step.title}
                        </h4>
                        {isCurrent && (
                          <span className="bg-primary-soft text-primary-soft-foreground text-micro rounded px-1.5 font-semibold">
                            {dict.currentStatus}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-caption",
                          isCurrent ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {step.defaultNote}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* 4. Fulfillment Details Card */}
          <section
            className="bg-card border-border rounded-xl border p-4 shadow-none"
            data-testid="tracking-fulfillment-card"
          >
            <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-1.5">
                {isDelivery ? (
                  <Truck
                    className="text-primary h-4 w-4"
                    aria-hidden="true"
                    data-testid="tracking-delivery-icon"
                  />
                ) : (
                  <Store
                    className="text-primary h-4 w-4"
                    aria-hidden="true"
                    data-testid="tracking-pickup-icon"
                  />
                )}
                <h3 className="text-label-sm text-muted-foreground tracking-wider uppercase">
                  {dict.fulfillmentDetails}
                </h3>
              </div>
              <Badge variant="outline" className="text-micro font-semibold">
                {order.serviceType === "pickup" ? dict.pickup : dict.delivery}
              </Badge>
            </div>

            <div className="mt-3 space-y-2.5">
              <div>
                <span className="text-muted-foreground text-xs font-medium">
                  {order.serviceType === "pickup" ? dict.pickupWindow : dict.deliveryTime}
                </span>
                <p className="text-foreground text-xs font-semibold tabular-nums">
                  {order.requestedDate} · {order.requestedTime ?? dict.asap}
                </p>
              </div>

              {isDelivery && deliveryAddress && (
                <dl
                  className="border-border/60 border-t pt-2.5"
                  data-testid="tracking-delivery-address"
                >
                  <dt className="text-muted-foreground text-xs font-medium">{dict.deliveryTo}</dt>
                  <dd className="text-foreground mt-0.5 text-xs font-semibold wrap-break-word">
                    {deliveryAddress}
                  </dd>
                </dl>
              )}

              {!isDelivery && (
                <div className="border-border/60 flex items-start justify-between gap-3 border-t pt-2.5">
                  <div>
                    <p className="text-foreground text-xs font-bold">{business.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{business.address}</p>
                  </div>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="tracking-directions-link"
                      className="border-border hover:bg-muted text-primary inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors active:opacity-80"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{dict.directions}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* 5. Order Summary Card */}
          <section
            className="bg-card border-border rounded-xl border p-4 shadow-none"
            data-testid="tracking-summary-card"
          >
            <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
              <h3 className="text-label-sm text-muted-foreground tracking-wider uppercase">
                {dict.orderSummary} ({order.items.reduce((acc, it) => acc + it.quantity, 0)})
              </h3>
              <Badge
                variant={order.paid === "paid" ? "paid" : "unpaid"}
                className="text-micro font-semibold"
              >
                {order.paid === "paid"
                  ? dict.paidBadge
                  : order.paid === "refunded"
                    ? dict.refundedBadge
                    : dict.unpaidBadge}
              </Badge>
            </div>

            {/* Items */}
            <div className="divide-border/60 divide-y">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-muted text-foreground text-caption flex h-5 w-5 shrink-0 items-center justify-center rounded font-bold tabular-nums">
                      {item.quantity}×
                    </span>
                    <div>
                      <p className="text-foreground text-xs font-semibold">{item.productName}</p>
                      <p className="text-muted-foreground text-micro tabular-nums">
                        {formatMoney(item.unitPrice, locale)}
                      </p>
                    </div>
                  </div>
                  <span className="text-foreground text-xs font-semibold tabular-nums">
                    {formatMoney(item.totalPrice, locale)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="border-border/60 space-y-1.5 border-t pt-2.5 text-xs">
              <div className="border-border flex justify-between border-t border-dashed pt-2 font-bold">
                <span className="text-foreground text-sm">{dict.totalAmount}</span>
                <span className="text-primary text-sm tabular-nums">
                  {formatMoney(order.totalAmount, locale)}
                </span>
              </div>
            </div>
          </section>

          {/* 6. Contact & Action Section */}
          <section className="space-y-2.5 pt-2">
            {cleanPhone && (
              <a
                href={`tel:${cleanPhone}`}
                className="border-border bg-card text-foreground hover:bg-muted flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors active:scale-95"
                data-testid="tracking-contact-button"
              >
                <Phone className="text-primary h-4 w-4" />
                <span>
                  {dict.contactShop} ({business.phone})
                </span>
              </a>
            )}
            <p className="text-muted-foreground text-center text-xs leading-relaxed">
              {dict.contactShopDesc}
            </p>

            <div className="pt-2">
              <Link
                href={`/${locale}`}
                className="hover:bg-muted text-primary flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors active:opacity-80"
                data-testid="tracking-back-catalog-button"
              >
                <Store className="h-4 w-4" />
                <span>{dict.backToCatalog}</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
