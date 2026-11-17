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
  Truck,
  PhoneCall,
  CircleDot,
  RotateCcw,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMoney,
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatTime,
  type OrderStatus,
} from "@/domain";
import { useBusinessTimeZone } from "@/components/time/business-timezone";
import {
  progressOrderStatusAction,
  recordPaymentAction,
  recordRefundAction,
  markOrderUnpaidAction,
  markPaidAndCompleteAction,
} from "../order-actions";
import type { EnrichedOrder } from "../order-data";
import { cn } from "@/lib/utils";
import { actionErrorMessage } from "@/lib/actions/error-message";

export interface OrderDetailProps {
  order: EnrichedOrder;
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

function getNextStep(status: string): NextStepConfig | null {
  switch (status) {
    case "NEW":
      return { nextStatus: "CONFIRMED", label: "Confirm order", icon: CheckCircle2 };
    case "CONFIRMED":
      return { nextStatus: "PREPARING", label: "Start preparing", icon: ChefHat };
    case "PREPARING":
      return { nextStatus: "READY", label: "Mark as ready", icon: PackageCheck };
    case "READY":
      return { nextStatus: "COMPLETED", label: "Complete order", icon: Check };
    default:
      return null;
  }
}

function formatRequestedDateTime(requestedDate?: string | null, requestedTime?: string | null) {
  if (!requestedDate) {
    return requestedTime ? `Today at ${requestedTime}` : "ASAP";
  }

  const formattedDate = formatCalendarDate(requestedDate, "en", "medium");

  if (requestedTime) {
    return `${formattedDate} at ${requestedTime}`;
  }
  return `${formattedDate} (ASAP)`;
}

export function OrderDetail({ order, refundDisabledReason }: OrderDetailProps) {
  const timeZone = useBusinessTimeZone();
  const router = useRouter();
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<
    "cash" | "revolut" | "wero"
  >("cash");
  const [paymentDialogMode, setPaymentDialogMode] = React.useState<"record" | "shortcut">("record");
  const [refundDialogOpen, setRefundDialogOpen] = React.useState(false);
  const [refundReason, setRefundReason] = React.useState("");

  const nextStep = getNextStep(currentOrder.status);
  const isNotPaid = currentOrder.paid !== "paid";
  const isReadyUnpaid = currentOrder.status === "READY" && currentOrder.paid === "unpaid";
  const isReadyNotPaid = currentOrder.status === "READY" && isNotPaid;

  // Handle Next Status Progression
  const handleProgressStatus = async () => {
    if (!nextStep) return;
    if (nextStep.nextStatus === "COMPLETED" && isNotPaid) {
      setErrorMessage(
        "Cannot complete order while payment is not marked as paid. Please record payment first.",
      );
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
      setErrorMessage(actionErrorMessage(res));
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
      setErrorMessage(actionErrorMessage(res));
    }
  };

  // Handle Rejecting Web Order (NEW -> CANCELLED with mandatory reason)
  const handleRejectOrder = async () => {
    const trimmed = rejectionReason.trim();
    if (!trimmed) {
      setRejectionError("A reason is required when rejecting a new order.");
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
      setErrorMessage(actionErrorMessage(res));
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
      setErrorMessage(actionErrorMessage(res));
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
      setErrorMessage(actionErrorMessage(res));
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
      setErrorMessage(actionErrorMessage(res));
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
      setErrorMessage(actionErrorMessage(res));
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

  // Tax calculation for breakdown (10% VAT on food)
  const includedTax = Math.round(currentOrder.totalAmount * 0.1 * 100) / 100;
  const subtotal = currentOrder.totalAmount - includedTax;

  // Predictive Full Journey Timeline
  const timelineSteps = React.useMemo(() => {
    if (currentOrder.status === "CANCELLED") {
      const history = currentOrder.statusHistory ?? [
        { status: "NEW", timestamp: currentOrder.createdAt, note: "Order placed" },
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
          label: isCancelled ? "Order Cancelled" : ev.status,
          state: isCancelled ? ("ongoing" as const) : ("validated" as const),
          timestampText: formatDateTime(ev.timestamp, timeZone, "en"),
          note: ev.note ?? (isCancelled ? currentOrder.cancellationReason : null),
        };
      });
    }

    const STANDARD_STEPS: { status: OrderStatus; label: string; defaultNote: string }[] = [
      { status: "NEW", label: "Order Placed", defaultNote: `Received via ${currentOrder.channel}` },
      { status: "CONFIRMED", label: "Confirmed", defaultNote: "Confirmed by kitchen" },
      { status: "PREPARING", label: "Preparing", defaultNote: "Kitchen preparing items" },
      {
        status: "READY",
        label: currentOrder.serviceType === "pickup" ? "Ready for Pickup" : "Out for Delivery",
        defaultNote:
          currentOrder.serviceType === "pickup" ? "Packed at counter" : "Dispatched with driver",
      },
      { status: "COMPLETED", label: "Completed", defaultNote: "Handed over to customer" },
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
            ? formatDateTime(historyEv.timestamp, timeZone, "en")
            : "Completed",
          note: historyEv?.note ?? step.defaultNote,
        };
      }

      if (stepRank === currentRank) {
        return {
          status: step.status,
          label: step.label,
          state: "ongoing" as const,
          timestampText: historyEv ? formatDateTime(historyEv.timestamp, timeZone, "en") : "Now",
          note: historyEv?.note ?? step.defaultNote,
        };
      }

      return {
        status: step.status,
        label: step.label,
        state: "future" as const,
        timestampText: "Upcoming",
        note: step.defaultNote,
      };
    });
  }, [currentOrder, timeZone]);

  return (
    <div className="flex flex-col gap-3 pb-36" data-testid="order-detail-screen">
      {/* Top Header with Back link and Print action (Stitch M-21) */}
      <div className="flex items-center justify-between pt-1">
        <Link
          href="/manage/orders"
          className="text-foreground hover:text-primary flex items-center gap-1.5 text-sm font-semibold transition-colors"
          data-testid="back-to-orders-link"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Orders</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant={STATUS_BADGE_MAP[currentOrder.status] ?? "default"} className="text-xs">
            {currentOrder.status}
          </Badge>
          {/* TODO(print): wire to thermal receipt printer (#48) */}
          <button
            type="button"
            onClick={handlePrint}
            aria-label="Print kitchen ticket"
            className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg border transition-colors active:scale-95"
            data-testid="print-ticket-button"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>

      {printNotice && (
        <div className="bg-primary-soft text-primary-soft-foreground flex items-center justify-between rounded-lg p-2.5 text-xs font-medium">
          <span>Kitchen ticket print job queued (mock printer).</span>
          <button
            type="button"
            onClick={() => setPrintNotice(false)}
            className="text-xs font-bold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Title & Metadata */}
      <div>
        <h1 className="text-foreground text-xl font-bold tracking-tight">
          Order #{currentOrder.orderNumber ?? "—"}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Created on {formatDate(currentOrder.createdAt, timeZone, "en", "long")} at{" "}
          {formatTime(currentOrder.createdAt, timeZone, "en")} • via {currentOrder.channel}
        </p>
      </div>

      {errorMessage && (
        <div
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm"
          role="alert"
          data-testid="order-detail-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Guest & Service Card (Matching Stitch M-21) */}
      <section
        className="bg-card border-border rounded-xl border p-3.5 shadow-none"
        data-testid="guest-service-card"
      >
        <div className="border-border/60 flex items-center justify-between border-b pb-2.5">
          <span className="text-muted-foreground text-caption font-bold tracking-wider uppercase">
            Guest &amp; Service
          </span>
          <span className="bg-primary-soft text-primary-soft-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize">
            {currentOrder.serviceType === "pickup" ? (
              <ShoppingBag className="h-3 w-3" />
            ) : (
              <Truck className="h-3 w-3" />
            )}
            <span>{currentOrder.serviceType}</span>
          </span>
        </div>

        <div className="pt-2.5">
          <h2 className="text-foreground mb-0.5 text-base font-bold">{currentOrder.guestName}</h2>
          <div className="mb-3 flex min-w-0 items-center gap-1.5 text-xs font-medium">
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {currentOrder.guestPhone ?? "No phone recorded"}
            </span>
            {currentOrder.submittedName &&
              currentOrder.submittedName !== currentOrder.guestName && (
                <>
                  <span className="text-muted-foreground/60 shrink-0">•</span>
                  <span
                    data-testid="order-submitted-name-badge"
                    title={`Ordered as ${currentOrder.submittedName}`}
                    className="bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/30 text-caption min-w-0 truncate rounded border px-1.5 py-0.5 font-medium"
                  >
                    Ordered as {currentOrder.submittedName}
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
                <span>Call</span>
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
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          )}

          {/* Service Metadata Details Box */}
          <div className="bg-muted/40 border-border/60 space-y-2 rounded-lg border p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>Deadline</span>
              </span>
              <span className="text-foreground font-bold tabular-nums">
                {formatRequestedDateTime(currentOrder.requestedDate, currentOrder.requestedTime)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
                <PhoneCall className="h-3.5 w-3.5" />
                <span>Channel</span>
              </span>
              <span className="text-foreground font-semibold capitalize">
                {currentOrder.channel} order
              </span>
            </div>

            {/* Delivery address directly below when delivery */}
            {currentOrder.deliveryAddress && (
              <div className="border-border/60 flex items-start justify-between gap-2 border-t pt-1">
                <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 font-medium">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Address</span>
                </span>
                <span className="text-foreground text-right font-semibold">
                  {currentOrder.deliveryAddress}
                </span>
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
            <h2 className="text-foreground text-sm font-bold">Order Items</h2>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
              {currentOrder.items.reduce((s, it) => s + it.quantity, 0)} items
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            Ticket #{currentOrder.orderNumber ?? "—"}
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
                    Unit {formatMoney(item.unitPrice)}
                  </p>
                </div>
              </div>
              <span className="text-foreground text-sm font-bold tabular-nums">
                {formatMoney(item.totalPrice)}
              </span>
            </div>
          ))}
        </div>

        {/* Special Instructions Pill BEFORE Subtotal (per user instruction) */}
        {currentOrder.notes && (
          <div className="bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/30 my-2.5 flex items-center gap-2 rounded-lg border p-2 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Kitchen note:</strong> {currentOrder.notes}
            </span>
          </div>
        )}

        {/* Price Breakdown with Subtotal, VAT tax, and Total */}
        <div className="border-border/60 space-y-1.5 border-t pt-2.5 text-xs">
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Subtotal</span>
            <span className="text-foreground font-medium tabular-nums">
              {formatMoney(subtotal)}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Tax (incl. VAT)</span>
            <span className="text-foreground font-medium tabular-nums">
              {formatMoney(includedTax)}
            </span>
          </div>
          <div className="border-border/60 flex items-center justify-between border-t pt-2">
            <span className="text-foreground text-sm font-bold">Total</span>
            <span className="text-foreground text-base font-bold tabular-nums">
              {formatMoney(currentOrder.totalAmount)}
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
            Payment
          </span>
          {currentOrder.status === "CANCELLED" && currentOrder.paid === "paid" ? (
            <Badge
              variant="warning"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
              data-testid="refund-due-badge"
            >
              <AlertCircle className="h-3 w-3" />
              Refund Due
            </Badge>
          ) : currentOrder.paid === "paid" ? (
            <Badge
              variant="paid"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
            >
              <CheckCircle2 className="h-3 w-3" />
              Paid
            </Badge>
          ) : currentOrder.paid === "refunded" ? (
            <Badge
              variant="refunded"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
              data-testid="refunded-badge"
            >
              <CheckCircle2 className="h-3 w-3" />
              Refunded
            </Badge>
          ) : (
            <Badge
              variant="unpaid"
              className="gap-1 py-0.5 text-xs font-bold tracking-wide uppercase"
            >
              <AlertCircle className="h-3 w-3" />
              Unpaid
            </Badge>
          )}
        </div>

        <div className="space-y-2.5 pt-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Method requested</span>
            <div className="text-foreground inline-flex items-center gap-1.5 font-semibold uppercase">
              <CreditCard className="text-primary h-3.5 w-3.5" />
              <span>{currentOrder.paymentPreference.replace("_", " ")}</span>
            </div>
          </div>

          {currentOrder.paid === "paid" && currentOrder.paymentMethod && (
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Settled via</span>
              <span className="text-foreground font-medium capitalize">
                {currentOrder.paymentMethod}
                {currentOrder.paidAt &&
                  ` on ${formatDate(currentOrder.paidAt, timeZone, "en", "short")} at ${formatTime(currentOrder.paidAt, timeZone, "en")}`}
              </span>
            </div>
          )}

          {currentOrder.paid === "refunded" && (
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>Settlement</span>
              <span className="text-foreground font-medium capitalize">
                Refunded
                {currentOrder.refundedAt &&
                  ` on ${formatDate(currentOrder.refundedAt, timeZone, "en", "short")} at ${formatTime(currentOrder.refundedAt, timeZone, "en")}`}
              </span>
            </div>
          )}

          {currentOrder.status === "CANCELLED" && currentOrder.paid === "paid" && (
            <div className="bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/30 flex flex-col gap-2 rounded-lg border p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="text-warning-soft-foreground h-4 w-4 shrink-0" />
                <span>Order was paid before cancellation. Refund required.</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRefundDialogOpen(true)}
                disabled={Boolean(refundDisabledReason)}
                aria-describedby={refundDisabledReason ? "refund-owner-only" : undefined}
                className="border-warning-soft-foreground text-warning-soft-foreground hover:bg-warning-soft/80 min-h-10 w-full gap-1.5 text-xs font-semibold"
                data-testid="record-refund-cta"
              >
                <CreditCard className="h-4 w-4" />
                <span>Record refund ({formatMoney(currentOrder.totalAmount)})</span>
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
                <span>Record refund (customer dispute)</span>
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
                  <span>Mark as unpaid (undo)</span>
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
              <span>Record payment ({formatMoney(currentOrder.totalAmount)})</span>
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
          <h2 className="text-foreground text-sm font-bold">Order Timeline</h2>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            Status: {currentOrder.status}
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
                      ({step.status})
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
        <div
          className="bg-card/95 border-border pb-safe-3.5 fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-xl flex-col gap-2 border-t p-3.5 shadow-lg backdrop-blur"
          data-testid="order-actions-bar"
        >
          {isReadyNotPaid && (
            <div className="bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/30 text-caption flex items-center gap-1.5 rounded-lg border p-2 font-semibold">
              <AlertCircle className="text-warning-soft-foreground h-3.5 w-3.5 shrink-0" />
              <span>Payment required before completing order handover</span>
            </div>
          )}

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
                  <span>Accept order</span>
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
                  <span>Reject order</span>
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
                <span>Mark paid & complete ({formatMoney(currentOrder.totalAmount)})</span>
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
                <span>Cancel</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Reject Order Dialog (NEW orders) */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="reject-order-dialog">
          <DialogHeader>
            <DialogTitle>Reject Order #{currentOrder.orderNumber}</DialogTitle>
            <DialogDescription>
              Rejecting this order will cancel it and restore reserved items back to inventory.
              Please specify the reason for the customer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2">
            <label htmlFor="reject-reason-input" className="text-foreground text-xs font-semibold">
              Rejection Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="reject-reason-input"
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (rejectionError && e.target.value.trim()) {
                  setRejectionError(null);
                }
              }}
              placeholder="e.g. Kitchen at capacity, item unavailable, outside delivery area..."
              className="text-xs"
              data-testid="reject-reason-input"
            />
            {rejectionError && (
              <p className="text-destructive text-xs" data-testid="reject-reason-error">
                {rejectionError}
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isSubmitting}
            >
              Keep order
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRejectOrder}
              disabled={isSubmitting || !rejectionReason.trim()}
              data-testid="confirm-reject-button"
            >
              {isSubmitting ? "Rejecting..." : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent data-testid="cancel-order-dialog">
          <DialogHeader>
            <DialogTitle>Cancel Order #{currentOrder.orderNumber}</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this order? This will release reserved stock back into
              inventory.
            </DialogDescription>
          </DialogHeader>

          {currentOrder.paid === "paid" && (
            <div
              className="bg-warning-soft text-warning-soft-foreground border-warning-soft-foreground/30 flex items-start gap-2 rounded-lg border p-2.5 text-xs font-semibold"
              data-testid="cancel-paid-warning"
            >
              <AlertCircle className="text-warning-soft-foreground mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span>
                  This order was marked as paid ({formatMoney(currentOrder.totalAmount)}{" "}
                  {currentOrder.paymentMethod
                    ? `via ${currentOrder.paymentMethod.charAt(0).toUpperCase() + currentOrder.paymentMethod.slice(1)}`
                    : ""}
                  ).
                </span>
                <span className="text-muted-foreground font-normal">
                  Please remember to issue a refund manually to the customer.
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 py-2">
            <label className="text-foreground text-xs font-semibold">
              Cancellation Reason (optional)
            </label>
            <Textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g. Customer requested, kitchen issue..."
              className="text-xs"
              data-testid="cancel-reason-input"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isSubmitting}
            >
              Keep order
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={isSubmitting}
              data-testid="confirm-cancel-button"
            >
              {isSubmitting ? "Cancelling..." : "Confirm cancellation"}
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
                ? `Mark Paid & Complete Order #${currentOrder.orderNumber}`
                : `Record Payment for Order #${currentOrder.orderNumber}`}
            </DialogTitle>
            <DialogDescription>
              Select payment method used for {formatMoney(currentOrder.totalAmount)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-3">
            {(["cash", "revolut", "wero"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setSelectedPaymentMethod(method)}
                className={cn(
                  "flex min-h-11 items-center justify-between rounded-lg border p-3 text-xs font-semibold capitalize transition-colors",
                  selectedPaymentMethod === method
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
                data-testid={`payment-method-${method}`}
              >
                <span>{method}</span>
                {selectedPaymentMethod === method && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={handleRecordPayment}
              disabled={isSubmitting}
              data-testid="confirm-payment-button"
            >
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent data-testid="record-refund-dialog">
          <DialogHeader>
            <DialogTitle>Record Refund for Order #{currentOrder.orderNumber}</DialogTitle>
            <DialogDescription>
              Confirm refund of {formatMoney(currentOrder.totalAmount)} returned to customer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2">
            <label className="text-foreground text-xs font-semibold">
              Refund Reason (optional)
            </label>
            <Textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Order cancelled, quality dispute, item missing..."
              className="text-xs"
              data-testid="refund-reason-input"
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-primary text-primary-foreground"
              onClick={handleRecordRefund}
              disabled={isSubmitting}
              data-testid="confirm-refund-button"
            >
              {isSubmitting ? "Recording..." : "Confirm refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
