"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Ban,
  ChefHat,
  PackageCheck,
  Check,
  Printer,
  ShoppingBag,
  Store,
  Truck,
  PhoneCall,
  CircleDot,
  RotateCcw,
} from "lucide-react";
import { Alert } from "@/components/ui";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ActionBar } from "@/components/ui/action-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMoney,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatTime,
  resolvePickupDisplay,
  splitOrderTotal,
  type OrderStatus,
  type PaymentMethod,
} from "@/domain";
import { useBusinessTimeZone } from "@/components/time/business-timezone";
import {
  progressOrderStatusAction,
  recordPaymentAction,
  recordRefundAction,
  markOrderUnpaidAction,
  markPaidAndCompleteAction,
} from "../order-actions";
import type { EnrichedOrder, OrderShopInfo } from "../order-data";
import { cn } from "@/lib/utils";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";
import { interpolate, type OrdersDictionary, type SupportedLocale } from "@/domain/i18n";

export interface OrderDetailProps {
  order: EnrichedOrder;
  /** Business name and address for shop-pickup orders (when `order.pickupLocation` is absent). */
  shop?: OrderShopInfo;
  /** Set for a member who is not an owner: refunds are owner-only, the control is disabled with this reason. */
  refundDisabledReason?: string;
}

const STATUS_BADGE_MAP: Record<string, NonNullable<BadgeProps["variant"]>> = {
  NEW: "new",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

interface NextStepConfig {
  nextStatus: "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function getNextStep(status: string, t: OrdersDictionary["detail"]): NextStepConfig | null {
  switch (status) {
    case "NEW":
      return { nextStatus: "CONFIRMED", label: t.nextStep.confirm, icon: CheckCircle2 };
    case "CONFIRMED":
      return { nextStatus: "PREPARING", label: t.nextStep.startPreparing, icon: ChefHat };
    case "PREPARING":
      return { nextStatus: "READY", label: t.nextStep.markReady, icon: PackageCheck };
    case "READY":
      return { nextStatus: "COMPLETED", label: t.nextStep.complete, icon: Check };
    default:
      return null;
  }
}

function formatRequestedDateTime(
  requestedDate: string | null | undefined,
  requestedTime: string | null | undefined,
  locale: SupportedLocale,
  t: OrdersDictionary["detail"],
) {
  if (!requestedDate) {
    return requestedTime ? interpolate(t.timeToday, { time: requestedTime }) : t.asap;
  }

  const date = formatCalendarDate(requestedDate, locale, "medium");

  if (requestedTime) {
    return interpolate(t.dateAtTime, { date, time: requestedTime });
  }
  return interpolate(t.dateAsap, { date });
}

export function OrderDetail({ order, shop, refundDisabledReason }: OrderDetailProps) {
  const timeZone = useBusinessTimeZone();
  const router = useRouter();
  const { locale, dict } = useManagerLocale();
  const o = dict.orders;
  const t = o.detail;
  const [currentOrder, setCurrentOrder] = React.useState<EnrichedOrder>(order);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [printNotice, setPrintNotice] = React.useState(false);

  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancellationReason, setCancellationReason] = React.useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [rejectionError, setRejectionError] = React.useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [paymentDialogMode, setPaymentDialogMode] = React.useState<"record" | "shortcut">("record");
  const [refundDialogOpen, setRefundDialogOpen] = React.useState(false);
  const [refundReason, setRefundReason] = React.useState("");

  const nextStep = getNextStep(currentOrder.status, t);
  const isNotPaid = currentOrder.paid !== "paid";
  const isReadyUnpaid = currentOrder.status === "READY" && currentOrder.paid === "unpaid";
  const isReadyNotPaid = currentOrder.status === "READY" && isNotPaid;

  // Handle Next Status Progression
  const handleProgressStatus = async () => {
    if (!nextStep) return;
    if (nextStep.nextStatus === "COMPLETED" && isNotPaid) {
      setErrorMessage(t.cannotCompleteUnpaid);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await progressOrderStatusAction({
      orderId: currentOrder.id,
      nextStatus: nextStep.nextStatus,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Handle Accepting Web Order (NEW -> CONFIRMED)
  const handleAcceptOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await progressOrderStatusAction({
      orderId: currentOrder.id,
      nextStatus: "CONFIRMED",
    });

    setIsSubmitting(false);

    if (res.ok) {
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Handle Rejecting Web Order (NEW -> CANCELLED with mandatory reason)
  const handleRejectOrder = async () => {
    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setRejectionError(t.reject.required);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await progressOrderStatusAction({
      orderId: currentOrder.id,
      nextStatus: "CANCELLED",
      reason: trimmed,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setRejectDialogOpen(false);
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Handle Order Cancellation
  const handleCancelOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await progressOrderStatusAction({
      orderId: currentOrder.id,
      nextStatus: "CANCELLED",
      reason: cancellationReason.trim() || "Cancelled by manager",
    });

    setIsSubmitting(false);

    if (res.ok) {
      setCancelDialogOpen(false);
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Handle Payment Recording / Shortcut Progression
  const handleRecordPayment = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res =
      paymentDialogMode === "shortcut"
        ? await markPaidAndCompleteAction({
            orderId: currentOrder.id,
            paymentMethod: selectedPaymentMethod,
          })
        : await recordPaymentAction({
            orderId: currentOrder.id,
            paymentMethod: selectedPaymentMethod,
          });

    setIsSubmitting(false);

    if (res.ok) {
      setPaymentDialogOpen(false);
      setPaymentDialogMode("record");
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Handle Mark Unpaid (Undo)
  const handleMarkUnpaid = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await markOrderUnpaidAction({
      orderId: currentOrder.id,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Handle Refund Recording
  const handleRecordRefund = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await recordRefundAction({
      orderId: currentOrder.id,
      reason: refundReason.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.ok) {
      setRefundDialogOpen(false);
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Handle Receipt Print (TODO Signal from Stitch M-21)
  const handlePrint = () => {
    setPrintNotice(true);
    setTimeout(() => setPrintNotice(false), 3000);
  };

  // WhatsApp link generator
  const cleanPhone = currentOrder.guestPhone?.replace(/\D/g, "");
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  // Pickup location display (relay snapshot or shop fallback; null for non-pickup orders)
  const pickupDisplay = resolvePickupDisplay(
    currentOrder.serviceType,
    currentOrder.pickupLocation,
    shop,
    o.storePickup,
  );

  // Totals breakdown (pre-tax food subtotal, 10% included VAT, and relay pickup fee)
  const { subtotal, includedTax, pickupFeeCents } = splitOrderTotal(
    currentOrder.totalAmount,
    currentOrder.pickupFeeCents,
  );

  // Predictive Full Journey Timeline
  const timelineSteps = React.useMemo(() => {
    if (currentOrder.status === "CANCELLED") {
      const history = currentOrder.statusHistory ?? [
        { status: "NEW", timestamp: currentOrder.createdAt, note: t.timeline.placed },
        {
          status: "CANCELLED",
          timestamp: currentOrder.updatedAt,
          note: currentOrder.cancellationReason,
        },
      ];
      return history.map((ev) => {
        const isCancelled = ev.status === "CANCELLED";
        return {
          status: ev.status,
          label: isCancelled ? t.timeline.cancelled : o.status[ev.status],
          state: isCancelled ? ("ongoing" as const) : ("validated" as const),
          timestampText: formatDateTime(ev.timestamp, timeZone, locale),
          note: ev.note ?? (isCancelled ? currentOrder.cancellationReason : null),
        };
      });
    }

    const isPickup = currentOrder.serviceType === "pickup";
    const STANDARD_STEPS: { status: OrderStatus; label: string; defaultNote: string }[] = [
      {
        status: "NEW",
        label: t.timeline.placed,
        defaultNote: interpolate(t.timeline.placedNote, {
          channel: o.channels[currentOrder.channel],
        }),
      },
      { status: "CONFIRMED", label: t.timeline.confirmed, defaultNote: t.timeline.confirmedNote },
      { status: "PREPARING", label: t.timeline.preparing, defaultNote: t.timeline.preparingNote },
      {
        status: "READY",
        label: isPickup ? t.timeline.readyPickup : t.timeline.readyDelivery,
        defaultNote: isPickup ? t.timeline.readyPickupNote : t.timeline.readyDeliveryNote,
      },
      { status: "COMPLETED", label: t.timeline.completed, defaultNote: t.timeline.completedNote },
    ];

    const ORDER_RANKS: Record<OrderStatus, number> = {
      NEW: 0,
      CONFIRMED: 1,
      PREPARING: 2,
      READY: 3,
      COMPLETED: 4,
      CANCELLED: -1,
    };

    const currentRank = ORDER_RANKS[currentOrder.status] ?? 0;

    return STANDARD_STEPS.map((step) => {
      const stepRank = ORDER_RANKS[step.status];
      const historyEv = currentOrder.statusHistory?.find((h) => h.status === step.status);

      if (stepRank < currentRank) {
        return {
          status: step.status,
          label: step.label,
          state: "validated" as const,
          timestampText: historyEv
            ? formatDateTime(historyEv.timestamp, timeZone, locale)
            : t.timeline.done,
          note: historyEv?.note ?? step.defaultNote,
        };
      }

      if (stepRank === currentRank) {
        return {
          status: step.status,
          label: step.label,
          state: "ongoing" as const,
          timestampText: historyEv
            ? formatDateTime(historyEv.timestamp, timeZone, locale)
            : t.timeline.now,
          note: historyEv?.note ?? step.defaultNote,
        };
      }

      return {
        status: step.status,
        label: step.label,
        state: "future" as const,
        timestampText: t.timeline.upcoming,
        note: step.defaultNote,
      };
    });
  }, [currentOrder, timeZone, locale, o, t]);

  return (
    <div className="flex flex-col gap-3 pb-36" data-testid="order-detail-screen">
      {/* Top Header with Back link and Print action (Stitch M-21) */}
      <div className="flex items-center justify-between pt-1">
        <Link
          href="/manage/orders"
          className="text-foreground hover:text-primary flex min-h-9 items-center gap-1.5 text-sm font-semibold transition-colors"
          data-testid="back-to-orders-link"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.back}</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge
            variant={STATUS_BADGE_MAP[currentOrder.status] ?? "default"}
            className="text-xs uppercase"
          >
            {o.status[currentOrder.status]}
          </Badge>
          {/* TODO(print): wire to thermal receipt printer (#48) */}
          <Button
            variant="unstyled"
            size="none"
            type="button"
            onClick={handlePrint}
            aria-label={t.printTicket}
            className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors active:scale-95"
            data-testid="print-ticket-button"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {printNotice && (
        <div className="bg-primary-soft text-primary-soft-foreground flex items-center justify-between rounded-lg p-2.5 text-xs font-medium">
          <span>{t.printQueued}</span>
          <Button
            variant="unstyled"
            size="none"
            type="button"
            onClick={() => setPrintNotice(false)}
            className="text-xs font-bold underline"
          >
            {t.dismiss}
          </Button>
        </div>
      )}

      {/* Title & Metadata */}
      <div>
        <h1 className="text-title-lg text-foreground">
          {interpolate(t.orderTitle, { number: currentOrder.orderNumber ?? "—" })}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {interpolate(t.createdLine, {
            date: formatDate(currentOrder.createdAt, timeZone, locale, "long"),
            time: formatTime(currentOrder.createdAt, timeZone, locale),
            channel: o.channels[currentOrder.channel],
          })}
        </p>
      </div>

      {errorMessage && (
        <Alert tone="error" data-testid="order-detail-error">
          {errorMessage}
        </Alert>
      )}

      {/* 1. Guest & Service Card (Matching Stitch M-21) */}
      <section
        className="bg-card border-border rounded-xl border p-3.5 shadow-none"
        data-testid="guest-service-card"
      >
        <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
          <span className="text-muted-foreground text-caption font-bold tracking-wider uppercase">
            {t.guestService}
          </span>
          <span className="bg-primary-soft text-primary-soft-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize">
            {currentOrder.serviceType === "pickup" ? (
              <ShoppingBag className="h-3 w-3" />
            ) : (
              <Truck className="h-3 w-3" />
            )}
            <span>{o.service[currentOrder.serviceType]}</span>
          </span>
        </div>

        <div className="pt-2.5">
          <h2 className="text-title-sm text-foreground mb-0.5">{currentOrder.guestName}</h2>
          <div className="mb-3 flex min-w-0 items-center gap-1.5 text-xs font-medium">
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {currentOrder.guestPhone ?? t.noPhone}
            </span>
            {currentOrder.submittedName &&
              currentOrder.submittedName !== currentOrder.guestName && (
                <>
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span
                    data-testid="order-submitted-name-badge"
                    title={interpolate(o.orderedAs, { name: currentOrder.submittedName })}
                    className="bg-warning-soft text-warning-soft-foreground border-warning/30 text-caption min-w-0 truncate rounded border px-1.5 py-0.5 font-medium"
                  >
                    {interpolate(o.orderedAs, { name: currentOrder.submittedName })}
                  </span>
                </>
              )}
          </div>

          {/* Quick Contact Actions: 2-column Call & WhatsApp */}
          {currentOrder.guestPhone && (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <a
                href={`tel:${currentOrder.guestPhone}`}
                className="border-border bg-card text-foreground hover:bg-muted flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-all active:scale-95"
                data-testid="call-guest-button"
              >
                <Phone className="text-primary h-4 w-4" />
                <span>{t.call}</span>
              </a>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-border bg-card text-foreground hover:bg-muted flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-all active:scale-95"
                  data-testid="whatsapp-guest-button"
                >
                  <MessageSquare className="text-primary h-4 w-4" />
                  <span>{t.whatsapp}</span>
                </a>
              )}
            </div>
          )}

          {/* Service Metadata Details Box */}
          <div className="bg-muted/40 border-border/60 space-y-2 rounded-lg border p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>{t.deadline}</span>
              </span>
              <span className="text-foreground font-bold tabular-nums">
                {formatRequestedDateTime(
                  currentOrder.requestedDate,
                  currentOrder.requestedTime,
                  locale,
                  t,
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
                <PhoneCall className="h-3.5 w-3.5" />
                <span>{t.channel}</span>
              </span>
              <span className="text-foreground font-semibold capitalize">
                {o.channelOrders[currentOrder.channel]}
              </span>
            </div>

            {/* Delivery address directly below when delivery */}
            {currentOrder.serviceType === "delivery" && currentOrder.deliveryAddress && (
              <div className="border-border/60 flex items-start justify-between gap-2 border-t pt-1">
                <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.address}</span>
                </span>
                <span className="text-foreground text-right font-semibold">
                  {currentOrder.deliveryAddress}
                </span>
              </div>
            )}

            {/* Pickup location directly below when pickup */}
            {pickupDisplay && (
              <div
                className="border-border/60 flex items-start justify-between gap-2 border-t pt-2"
                data-testid="order-pickup-location"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
                    <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t.pickupLocation}</span>
                  </span>
                  <p
                    className="text-foreground font-semibold wrap-break-word"
                    data-testid="order-pickup-name"
                  >
                    {pickupDisplay.name}
                  </p>
                  {pickupDisplay.address && (
                    <p
                      className="text-muted-foreground wrap-break-word"
                      data-testid="order-pickup-address"
                    >
                      {pickupDisplay.address}
                    </p>
                  )}
                </div>
                {pickupDisplay.directionsUrl && (
                  <a
                    href={pickupDisplay.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={interpolate(t.directionsAria, { place: pickupDisplay.name })}
                    data-testid="order-pickup-directions"
                    className="border-border bg-card hover:bg-muted text-primary inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors active:opacity-80"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t.directions}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Order Items & Totals Card (Matching Stitch M-21) */}
      <section
        className="bg-card border-border rounded-xl border p-3.5 shadow-none"
        data-testid="order-items-card"
      >
        <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-title-sm text-foreground">{t.orderItems}</h2>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
              {interpolate(t.itemsCount, {
                count: currentOrder.items.reduce((s, it) => s + it.quantity, 0),
              })}
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            {interpolate(t.ticket, { number: currentOrder.orderNumber ?? "—" })}
          </span>
        </div>

        {/* Itemized List */}
        <div className="divide-border/60 divide-y">
          {currentOrder.items.map((item) => (
            <div
              key={item.id ?? item.productId}
              className="flex items-start justify-between gap-2 py-2.5"
            >
              <div className="flex items-start gap-2">
                <span className="bg-primary-soft text-primary-soft-foreground rounded px-1.5 py-0.5 text-xs font-bold tabular-nums">
                  {item.quantity}×
                </span>
                <div>
                  <p className="text-foreground text-sm font-semibold">{item.productName}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {interpolate(t.unitPrice, { price: formatMoney(item.unitPrice, locale) })}
                  </p>
                </div>
              </div>
              <span className="text-foreground text-sm font-bold tabular-nums">
                {formatMoney(item.totalPrice, locale)}
              </span>
            </div>
          ))}
        </div>

        {/* Special Instructions Pill BEFORE Subtotal (per user instruction) */}
        {currentOrder.notes && (
          <Alert tone="warning" className="my-2.5">
            <strong className="font-semibold">{t.kitchenNote}</strong> {currentOrder.notes}
          </Alert>
        )}

        {/* Price Breakdown with Subtotal, VAT tax, and Total */}
        <div className="border-border/60 space-y-1.5 border-t pt-2.5 text-xs">
          <div className="text-muted-foreground flex items-center justify-between">
            <span>{t.subtotal}</span>
            <span className="text-foreground font-medium tabular-nums">
              {formatMoney(subtotal, locale)}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between">
            <span>{t.tax}</span>
            <span className="text-foreground font-medium tabular-nums">
              {formatMoney(includedTax, locale)}
            </span>
          </div>
          {pickupFeeCents > 0 && (
            <div
              className="text-muted-foreground flex items-center justify-between"
              data-testid="order-pickup-fee"
            >
              <span>{t.pickupFee}</span>
              <span className="text-foreground font-medium tabular-nums">
                {formatMoney(pickupFeeCents, locale)}
              </span>
            </div>
          )}
          <div className="border-border/60 flex items-center justify-between border-t pt-2">
            <span className="text-foreground text-sm font-bold">{t.total}</span>
            <span className="text-foreground text-base font-bold tabular-nums">
              {formatMoney(currentOrder.totalAmount, locale)}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Payment Status Card (Matching Stitch M-21) */}
      <section
        className="bg-card border-border rounded-xl border p-3.5 shadow-none"
        data-testid="payment-card"
      >
        <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
          <span className="text-muted-foreground text-caption font-bold tracking-wider uppercase">
            {t.paymentTitle}
          </span>
          {currentOrder.status === "CANCELLED" && currentOrder.paid === "paid" ? (
            <Badge
              variant="warning"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
              data-testid="refund-due-badge"
            >
              <AlertCircle className="h-3 w-3" />
              {o.payment.refundDue}
            </Badge>
          ) : currentOrder.paid === "paid" ? (
            <Badge
              variant="paid"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
            >
              <CheckCircle2 className="h-3 w-3" />
              {o.payment.paid}
            </Badge>
          ) : currentOrder.paid === "refunded" ? (
            <Badge
              variant="refunded"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
              data-testid="refunded-badge"
            >
              <CheckCircle2 className="h-3 w-3" />
              {o.payment.refunded}
            </Badge>
          ) : (
            <Badge
              variant="unpaid"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
            >
              <AlertCircle className="h-3 w-3" />
              {o.payment.unpaid}
            </Badge>
          )}
        </div>

        <div className="space-y-2.5 pt-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{t.methodRequested}</span>
            <div className="text-foreground inline-flex items-center gap-1.5 font-semibold uppercase">
              <CreditCard className="text-primary h-3.5 w-3.5" />
              <span>{o.paymentPreferences[currentOrder.paymentPreference]}</span>
            </div>
          </div>

          {currentOrder.paid === "paid" && currentOrder.paymentMethod && (
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>{t.settledVia}</span>
              <span className="text-foreground font-medium capitalize">
                {o.paymentMethods[currentOrder.paymentMethod]}
                {currentOrder.paidAt &&
                  interpolate(t.onAt, {
                    date: formatDate(currentOrder.paidAt, timeZone, locale, "short"),
                    time: formatTime(currentOrder.paidAt, timeZone, locale),
                  })}
              </span>
            </div>
          )}

          {currentOrder.paid === "refunded" && (
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>{t.settlement}</span>
              <span className="text-foreground font-medium capitalize">
                {t.refundedLabel}
                {currentOrder.refundedAt &&
                  interpolate(t.onAt, {
                    date: formatDate(currentOrder.refundedAt, timeZone, locale, "short"),
                    time: formatTime(currentOrder.refundedAt, timeZone, locale),
                  })}
              </span>
            </div>
          )}

          {currentOrder.status === "CANCELLED" && currentOrder.paid === "paid" && (
            <Alert tone="warning" title={t.paidBeforeCancel}>
              <div className="mt-1 flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRefundDialogOpen(true)}
                  disabled={Boolean(refundDisabledReason)}
                  aria-describedby={refundDisabledReason ? "refund-owner-only" : undefined}
                  className="border-warning text-warning-soft-foreground hover:bg-warning-soft/80 min-h-10 w-full gap-1.5 text-xs font-semibold"
                  data-testid="record-refund-cta"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>
                    {interpolate(t.recordRefund, {
                      amount: formatMoney(currentOrder.totalAmount, locale),
                    })}
                  </span>
                </Button>
                {refundDisabledReason && (
                  <p
                    id="refund-owner-only"
                    className="text-muted-foreground text-body-sm"
                    data-testid="refund-owner-only"
                  >
                    {refundDisabledReason}
                  </p>
                )}
              </div>
            </Alert>
          )}

          {currentOrder.status === "COMPLETED" && currentOrder.paid === "paid" && (
            <div className="border-border/60 border-t pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRefundDialogOpen(true)}
                disabled={Boolean(refundDisabledReason)}
                aria-describedby={refundDisabledReason ? "refund-owner-only" : undefined}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted min-h-9 w-full gap-1.5 text-xs font-semibold"
                data-testid="post-completion-refund-button"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>{t.recordRefundDispute}</span>
              </Button>
              {refundDisabledReason && (
                <p
                  id="refund-owner-only"
                  className="text-muted-foreground text-body-sm"
                  data-testid="refund-owner-only"
                >
                  {refundDisabledReason}
                </p>
              )}
            </div>
          )}

          {currentOrder.status !== "COMPLETED" &&
            currentOrder.status !== "CANCELLED" &&
            currentOrder.paid === "paid" && (
              <div className="border-border/60 border-t pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMarkUnpaid}
                  disabled={isSubmitting}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted min-h-9 w-full gap-1.5 text-xs font-semibold"
                  data-testid="mark-unpaid-button"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t.markUnpaid}</span>
                </Button>
              </div>
            )}

          {currentOrder.paid === "unpaid" && currentOrder.status !== "CANCELLED" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPaymentDialogMode("record");
                setPaymentDialogOpen(true);
              }}
              className="border-primary text-primary hover:bg-primary-soft/50 min-h-11 w-full gap-1.5 text-xs font-semibold"
              data-testid="record-payment-button"
            >
              <CreditCard className="h-4 w-4" />
              <span>
                {interpolate(t.recordPayment, {
                  amount: formatMoney(currentOrder.totalAmount, locale),
                })}
              </span>
            </Button>
          )}
        </div>
      </section>

      {/* 4. Status History Timeline (Predictive Full Journey Matching Stitch M-21) */}
      <section
        className="bg-card border-border rounded-xl border p-3.5 shadow-none"
        data-testid="order-timeline-card"
      >
        <div className="border-border/60 mb-2.5 flex items-center justify-between border-b pb-2.5">
          <h2 className="text-title-sm text-foreground">{t.timelineTitle}</h2>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {interpolate(t.statusLine, { status: o.status[currentOrder.status] })}
          </span>
        </div>

        <div className="before:bg-border/60 relative space-y-4 pl-6 before:absolute before:top-2.5 before:bottom-2.5 before:left-2 before:w-0.5">
          {timelineSteps.map((step, idx) => {
            return (
              <div key={idx} className="relative flex flex-col gap-0.5">
                {/* Step Icon */}
                <div className="absolute top-0.5 -left-6 flex h-4 w-4 items-center justify-center">
                  {step.state === "validated" && (
                    <CheckCircle2 className="bg-card h-4 w-4 rounded-full text-emerald-600 dark:text-emerald-400" />
                  )}
                  {step.state === "ongoing" && (
                    <CircleDot
                      className={cn(
                        "bg-card h-4 w-4 rounded-full",
                        step.status === "CANCELLED"
                          ? "text-destructive"
                          : "text-warning-soft-foreground",
                      )}
                    />
                  )}
                  {step.state === "future" && (
                    <CircleDot className="text-muted-foreground/30 bg-card h-4 w-4 rounded-full" />
                  )}
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cn(
                      "text-xs font-bold",
                      step.state === "validated" && "text-foreground",
                      step.state === "ongoing" &&
                        (step.status === "CANCELLED"
                          ? "text-destructive"
                          : "text-warning-soft-foreground"),
                      step.state === "future" && "text-muted-foreground/75 font-medium",
                    )}
                  >
                    <span>{step.label}</span>
                    <span
                      className={cn(
                        "text-micro ml-1 font-semibold uppercase",
                        step.state === "ongoing" && step.status !== "CANCELLED"
                          ? "text-warning-soft-foreground/80"
                          : "text-muted-foreground",
                      )}
                    >
                      ({o.status[step.status as OrderStatus]})
                    </span>
                  </p>
                  <span
                    className={cn(
                      "text-caption shrink-0 tabular-nums",
                      step.state === "ongoing"
                        ? step.status === "CANCELLED"
                          ? "text-destructive font-bold"
                          : "text-warning-soft-foreground font-bold"
                        : step.state === "future"
                          ? "text-muted-foreground/75 italic"
                          : "text-muted-foreground font-medium",
                    )}
                  >
                    {step.timestampText}
                  </span>
                </div>
                {step.note && (
                  <p
                    className={cn(
                      "text-caption",
                      step.state === "future"
                        ? "text-muted-foreground/75"
                        : "text-muted-foreground",
                    )}
                  >
                    {step.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Sticky Bottom Action Bar (Z-50, Full-width clearance) */}
      {currentOrder.status !== "COMPLETED" && currentOrder.status !== "CANCELLED" && (
        <ActionBar
          placement="bottom"
          className="pb-safe-3.5 z-50 mx-auto max-w-xl px-3.5 pt-3.5"
          contentClassName="max-w-none flex-col items-stretch gap-2"
          data-testid="order-actions-bar"
        >
          {isReadyNotPaid && <Alert tone="warning">{t.paymentRequired}</Alert>}

          <div className="flex items-center gap-2">
            {currentOrder.status === "NEW" ? (
              <>
                <Button
                  type="button"
                  onClick={handleAcceptOrder}
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground min-h-11 flex-1 gap-1.5 text-xs font-semibold shadow-none active:scale-95"
                  data-testid="accept-order-button"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t.acceptOrder}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRejectionError(null);
                    setRejectionReason("");
                    setRejectDialogOpen(true);
                  }}
                  disabled={isSubmitting}
                  className="border-destructive text-destructive hover:bg-destructive/10 min-h-11 gap-1 px-3.5 text-xs font-semibold active:scale-95"
                  data-testid="reject-order-button"
                >
                  <Ban className="h-4 w-4" />
                  <span>{t.rejectOrder}</span>
                </Button>
              </>
            ) : isReadyUnpaid ? (
              <Button
                type="button"
                onClick={() => {
                  setPaymentDialogMode("shortcut");
                  setPaymentDialogOpen(true);
                }}
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground min-h-11 flex-1 gap-1.5 text-xs font-semibold shadow-none active:scale-95"
                data-testid="mark-paid-and-complete-button"
              >
                <Check className="h-4 w-4" />
                <span>
                  {interpolate(t.markPaidComplete, {
                    amount: formatMoney(currentOrder.totalAmount, locale),
                  })}
                </span>
              </Button>
            ) : nextStep ? (
              <Button
                type="button"
                onClick={handleProgressStatus}
                disabled={isSubmitting || (nextStep.nextStatus === "COMPLETED" && isNotPaid)}
                className="bg-primary text-primary-foreground min-h-11 flex-1 gap-1.5 text-xs font-semibold shadow-none active:scale-95"
                data-testid="next-status-action-button"
              >
                <nextStep.icon className="h-4 w-4" />
                <span>{nextStep.label}</span>
              </Button>
            ) : null}

            {currentOrder.status !== "NEW" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
                disabled={isSubmitting}
                className="border-destructive text-destructive hover:bg-destructive/10 min-h-11 gap-1 px-3.5 text-xs font-semibold active:scale-95"
                data-testid="cancel-order-button"
              >
                <Ban className="h-4 w-4" />
                <span>{t.cancel}</span>
              </Button>
            )}
          </div>
        </ActionBar>
      )}

      {/* Reject Order Dialog (NEW orders) */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="reject-order-dialog">
          <DialogHeader>
            <DialogTitle>
              {interpolate(t.reject.title, { number: currentOrder.orderNumber ?? "" })}
            </DialogTitle>
            <DialogDescription>{t.reject.description}</DialogDescription>
          </DialogHeader>

          <Field
            id="reject-reason-input"
            label={t.reject.reasonLabel}
            required
            error={rejectionError}
            className="py-2"
            data-testid="reject-reason"
          >
            <Textarea
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (rejectionError && e.target.value.trim()) {
                  setRejectionError(null);
                }
              }}
              placeholder={t.reject.placeholder}
              data-testid="reject-reason-input"
            />
          </Field>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t.reject.keep}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRejectOrder}
              disabled={isSubmitting || !rejectionReason.trim()}
              data-testid="confirm-reject-button"
            >
              {isSubmitting ? t.reject.submitting : t.reject.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent data-testid="cancel-order-dialog">
          <DialogHeader>
            <DialogTitle>
              {interpolate(t.cancelDialog.title, { number: currentOrder.orderNumber ?? "" })}
            </DialogTitle>
            <DialogDescription>{t.cancelDialog.description}</DialogDescription>
          </DialogHeader>

          {currentOrder.paid === "paid" && (
            <Alert tone="warning" data-testid="cancel-paid-warning">
              {interpolate(
                currentOrder.paymentMethod
                  ? t.cancelDialog.paidWarningVia
                  : t.cancelDialog.paidWarning,
                {
                  amount: formatMoney(currentOrder.totalAmount, locale),
                  method: currentOrder.paymentMethod
                    ? o.paymentMethods[currentOrder.paymentMethod]
                    : "",
                },
              )}
            </Alert>
          )}

          <Field id="cancel-reason-input" label={t.cancelDialog.reasonLabel} className="py-2">
            <Textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder={t.cancelDialog.placeholder}
              data-testid="cancel-reason-input"
            />
          </Field>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t.cancelDialog.keep}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={isSubmitting}
              data-testid="confirm-cancel-button"
            >
              {isSubmitting ? t.cancelDialog.submitting : t.cancelDialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) setPaymentDialogMode("record");
        }}
      >
        <DialogContent data-testid="record-payment-dialog">
          <DialogHeader>
            <DialogTitle>
              {paymentDialogMode === "shortcut"
                ? interpolate(t.paymentDialog.titleShortcut, {
                    number: currentOrder.orderNumber ?? "",
                  })
                : interpolate(t.paymentDialog.titleRecord, {
                    number: currentOrder.orderNumber ?? "",
                  })}
            </DialogTitle>
            <DialogDescription>
              {interpolate(t.paymentDialog.description, {
                amount: formatMoney(currentOrder.totalAmount, locale),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-3">
            {(["cash", "card", "revolut", "wero"] as const).map((method) => (
              <Button
                variant="unstyled"
                size="none"
                key={method}
                type="button"
                onClick={() => setSelectedPaymentMethod(method)}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-lg border p-3 text-xs font-semibold transition-colors",
                  selectedPaymentMethod === method
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
                data-testid={`payment-method-${method}`}
              >
                <span>{o.paymentMethods[method]}</span>
                {selectedPaymentMethod === method && <Check className="h-4 w-4" />}
              </Button>
            ))}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t.paymentDialog.cancel}
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={handleRecordPayment}
              disabled={isSubmitting}
              data-testid="confirm-payment-button"
            >
              {t.paymentDialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent data-testid="record-refund-dialog">
          <DialogHeader>
            <DialogTitle>
              {interpolate(t.refundDialog.title, { number: currentOrder.orderNumber ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {interpolate(t.refundDialog.description, {
                amount: formatMoney(currentOrder.totalAmount, locale),
              })}
            </DialogDescription>
          </DialogHeader>

          <Field id="refund-reason-input" label={t.refundDialog.reasonLabel} className="py-2">
            <Textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder={t.refundDialog.placeholder}
              data-testid="refund-reason-input"
            />
          </Field>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={isSubmitting}
            >
              {t.paymentDialog.cancel}
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={handleRecordRefund}
              disabled={isSubmitting}
              data-testid="confirm-refund-button"
            >
              {isSubmitting ? t.refundDialog.submitting : t.refundDialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
