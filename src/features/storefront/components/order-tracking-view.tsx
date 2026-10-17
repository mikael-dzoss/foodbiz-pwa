"use client";

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
  MapPin,
  Phone,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatMoney,
  formatTime,
  type Order,
  type Business,
  type OrderStatus,
  type SupportedLocale,
} from "@/domain";
import type { OrderTrackingDictionary, StorefrontDictionary } from "@/domain/i18n";
import { cn } from "@/lib/utils";

export interface OrderTrackingViewProps {
  order: Order;
  business: Business;
  locale: SupportedLocale;
  dict: OrderTrackingDictionary;
  storefrontDict?: StorefrontDictionary;
}

interface TimelineStepConfig {
  status: OrderStatus;
  title: string;
  defaultNote: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrderTrackingView({ order, business, locale, dict }: OrderTrackingViewProps) {
  const isCancelled = order.status === "CANCELLED";
  const isCompleted = order.status === "COMPLETED";

  // Calculate included tax (10% standard rate for food items)
  const includedTax = Math.round(order.totalAmount * 0.1 * 100) / 100;
  const subtotal = Math.max(0, order.totalAmount - includedTax);

  const cleanPhone = business.phone?.replace(/\D/g, "");
  const mapsUrl = business.address
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
            className="hover:bg-muted text-foreground -ml-1.5 flex h-10 w-10 items-center justify-center rounded-lg transition-colors active:scale-95"
            data-testid="tracking-back-button"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-col items-center text-center">
            <h1 className="font-headline text-foreground text-sm leading-tight font-semibold">
              {dict.title}
            </h1>
            <span className="text-muted-foreground text-xs font-medium">{business.name}</span>
          </div>
          <button
            type="button"
            aria-label="Order info"
            className="hover:bg-muted text-muted-foreground -mr-1.5 flex h-10 w-10 items-center justify-center rounded-lg transition-colors active:scale-95"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </header>

        {/* 2. Main Content */}
        <main className="flex-1 space-y-4 px-4 py-4">
          {/* Hero Order Header Card */}
          <section
            className="bg-card border-border rounded-xl border p-4 shadow-none"
            data-testid="tracking-header-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                  {dict.orderReference}
                </span>
                <div className="mt-0.5 flex items-center gap-2">
                  <h2
                    className="font-headline text-foreground text-xl font-bold tracking-tight tabular-nums"
                    data-testid="tracking-order-title"
                  >
                    Order #{order.orderNumber ?? "—"}
                  </h2>
                </div>
                <p className="text-muted-foreground mt-1 text-xs tabular-nums">
                  {dict.placedAt} {formatTime(order.createdAt, locale)}
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
                    <p className="text-muted-foreground text-[11px]">
                      {order.paid === "paid"
                        ? "Any payment made will be refunded directly. Contact the shop if you have questions."
                        : "No payment was taken for this order."}
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
                    {order.serviceType === "pickup"
                      ? dict.readyInApprox
                      : "Estimated delivery time"}
                  </p>
                  <p className="text-primary text-xs font-bold tabular-nums">
                    {order.requestedTime
                      ? `${order.requestedTime} (${order.serviceType === "pickup" ? "Pickup" : "Delivery"})`
                      : "20–25 min (ASAP)"}
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
              <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                {dict.liveOrderProgress}
              </h3>
              <span className="text-primary flex items-center gap-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{dict.updatingLive}</span>
              </span>
            </div>

            {isCancelled ? (
              <div className="before:bg-border relative space-y-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-[2px]">
                <div className="relative">
                  <span className="bg-primary text-primary-foreground absolute top-0 -left-6 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <p className="text-foreground text-xs font-bold">{dict.statuses.NEW}</p>
                  <p className="text-muted-foreground text-[11px]">{dict.stepNotes.placed}</p>
                </div>

                <div className="relative">
                  <span className="bg-destructive text-destructive-foreground absolute top-0 -left-6 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                    <RotateCcw className="h-2.5 w-2.5" />
                  </span>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-destructive text-xs font-bold">{dict.statuses.CANCELLED}</p>
                    <span className="bg-destructive/10 text-destructive py-0.2 rounded px-1.5 text-[10px] font-semibold">
                      Outcome
                    </span>
                  </div>
                  {order.cancellationReason && (
                    <p className="text-muted-foreground mt-0.5 text-[11px]">
                      {order.cancellationReason}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <ol className="before:bg-border relative space-y-5 pl-6 before:absolute before:top-2.5 before:bottom-2.5 before:left-2 before:w-[2px]">
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
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        ) : isCurrent ? (
                          <span className="bg-primary-foreground h-1.5 w-1.5 rounded-full" />
                        ) : (
                          <span className="bg-muted-foreground/40 h-1 w-1 rounded-full" />
                        )}
                      </span>

                      <div className="flex items-baseline justify-between gap-2">
                        <h4
                          className={cn(
                            "text-xs font-bold",
                            isCurrent && "text-primary",
                            isDone && "text-foreground",
                            state === "upcoming" && "text-muted-foreground/70 font-medium",
                          )}
                        >
                          {step.title}
                        </h4>
                        {isCurrent && (
                          <span className="bg-primary-soft text-primary-soft-foreground py-0.2 rounded px-1.5 text-[10px] font-semibold">
                            {dict.currentStatus}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-[11px]",
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
                <Store className="text-primary h-4 w-4" />
                <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  {dict.fulfillmentDetails}
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold">
                {order.serviceType === "pickup" ? "Storefront Pickup" : "Delivery"}
              </Badge>
            </div>

            <div className="mt-3 space-y-2.5">
              <div>
                <span className="text-muted-foreground text-xs font-medium">
                  {order.serviceType === "pickup" ? dict.pickupWindow : dict.deliveryAddress}
                </span>
                <p className="text-foreground text-xs font-semibold tabular-nums">
                  {order.serviceType === "pickup"
                    ? order.requestedTime
                      ? `Today at ${order.requestedTime}`
                      : "Today (ASAP)"
                    : (order.deliveryAddress ?? "Address provided at checkout")}
                </p>
              </div>

              {order.notes && (
                <div className="border-border/60 border-t pt-2.5">
                  <span className="text-muted-foreground text-xs font-medium">
                    Special instructions
                  </span>
                  <p className="text-foreground mt-0.5 text-xs">{order.notes}</p>
                </div>
              )}

              <div className="border-border/60 flex items-start justify-between gap-3 border-t pt-2.5">
                <div>
                  <p className="text-foreground text-xs font-bold">{business.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {business.address ?? "Store address on confirmation"}
                  </p>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border hover:bg-muted text-primary inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{dict.directions}</span>
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* 5. Order Summary Card */}
          <section
            className="bg-card border-border rounded-xl border p-4 shadow-none"
            data-testid="tracking-summary-card"
          >
            <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
              <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                {dict.orderSummary} ({order.items.reduce((acc, it) => acc + it.quantity, 0)} items)
              </h3>
              <Badge
                variant={order.paid === "paid" ? "paid" : "unpaid"}
                className="text-[10px] font-semibold"
              >
                {order.paid === "paid" ? dict.paidBadge : dict.unpaidBadge}
              </Badge>
            </div>

            {/* Items */}
            <div className="divide-border/60 divide-y">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="bg-muted text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold tabular-nums">
                      {item.quantity}×
                    </span>
                    <div>
                      <p className="text-foreground text-xs font-semibold">{item.productName}</p>
                      <p className="text-muted-foreground text-[10px] tabular-nums">
                        {formatMoney(item.unitPrice)} each
                      </p>
                    </div>
                  </div>
                  <span className="text-foreground text-xs font-semibold tabular-nums">
                    {formatMoney(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="border-border/60 space-y-1.5 border-t pt-2.5 text-xs">
              <div className="text-muted-foreground flex justify-between">
                <span>{dict.subtotal}</span>
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              <div className="text-muted-foreground flex justify-between">
                <span>{dict.taxIncluded}</span>
                <span className="tabular-nums">{formatMoney(includedTax)}</span>
              </div>
              <div className="border-border flex justify-between border-t border-dashed pt-2 font-bold">
                <span className="text-foreground text-sm">{dict.totalAmount}</span>
                <span className="text-primary text-sm tabular-nums">
                  {formatMoney(order.totalAmount)}
                </span>
              </div>
            </div>
          </section>

          {/* 6. Contact & Action Section */}
          <section className="space-y-2.5 pt-2">
            {cleanPhone && (
              <a
                href={`tel:${cleanPhone}`}
                className="border-border bg-card text-foreground hover:bg-muted flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors active:scale-95"
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
                className="hover:bg-muted text-primary flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors"
                data-testid="tracking-back-catalog-button"
              >
                <Store className="h-4 w-4" />
                <span>{dict.backToCatalog}</span>
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
