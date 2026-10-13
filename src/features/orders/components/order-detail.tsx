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
import { formatMoney, formatDate, formatTime } from "@/domain";
import type { EnrichedOrder } from "../order-actions";
import { progressOrderStatusAction, recordPaymentAction } from "../order-actions";
import { cn } from "@/lib/utils";

export interface OrderDetailProps {
  order: EnrichedOrder;
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

export function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter();
  const [currentOrder, setCurrentOrder] = React.useState<EnrichedOrder>(order);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancellationReason, setCancellationReason] = React.useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = React.useState<
    "cash" | "revolut" | "wero"
  >("cash");

  const nextStep = getNextStep(currentOrder.status);
  const isUnpaid = currentOrder.paid === "unpaid";
  const isReadyUnpaid = currentOrder.status === "READY" && isUnpaid;

  // Handle Next Status Progression
  const handleProgressStatus = async () => {
    if (!nextStep) return;
    if (nextStep.nextStatus === "COMPLETED" && isUnpaid) {
      setErrorMessage("Cannot complete order while it is unpaid. Please record payment first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await progressOrderStatusAction({
      orderId: currentOrder.id,
      nextStatus: nextStep.nextStatus,
    });

    setIsSubmitting(false);

    if (res.success) {
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(res.error);
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

    if (res.success) {
      setCancelDialogOpen(false);
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(res.error);
    }
  };

  // Handle Payment Recording
  const handleRecordPayment = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await recordPaymentAction({
      orderId: currentOrder.id,
      paymentMethod: selectedPaymentMethod,
    });

    setIsSubmitting(false);

    if (res.success) {
      setPaymentDialogOpen(false);
      setCurrentOrder({
        ...currentOrder,
        ...res.data,
      });
      router.refresh();
    } else {
      setErrorMessage(res.error);
    }
  };

  // WhatsApp link generator
  const cleanPhone = currentOrder.guestPhone?.replace(/\D/g, "");
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

  return (
    <div className="flex flex-col gap-4 pb-36" data-testid="order-detail-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <Link
          href="/manage/orders"
          className="text-primary hover:text-primary/80 flex items-center gap-1.5 text-sm font-semibold transition-colors"
          data-testid="back-to-orders-link"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Orders</span>
        </Link>
        <Badge variant={STATUS_BADGE_MAP[currentOrder.status] ?? "default"} className="text-sm">
          {currentOrder.status}
        </Badge>
      </div>

      <div>
        <h1 className="text-display-sm text-foreground font-bold">
          Order #{currentOrder.orderNumber ?? "—"}
        </h1>
        <p className="text-body-sm text-muted-foreground">
          Created on {formatDate(currentOrder.createdAt, "en", "long")} at{" "}
          {formatTime(currentOrder.createdAt, "en")} • via {currentOrder.channel}
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

      {/* Guest & Service Card */}
      <div
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
        data-testid="guest-service-card"
      >
        <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
          Guest & Service
        </span>

        <div className="flex flex-col gap-1">
          <span className="text-foreground text-lg font-semibold">{currentOrder.guestName}</span>
          {currentOrder.guestPhone && (
            <span className="text-body-sm text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {currentOrder.guestPhone}
            </span>
          )}
        </div>

        {/* Contact Quick Actions */}
        {currentOrder.guestPhone && (
          <div className="flex gap-2 pt-1">
            <a
              href={`tel:${currentOrder.guestPhone}`}
              className="border-border hover:bg-muted text-foreground flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors"
              data-testid="call-guest-button"
            >
              <Phone className="h-4 w-4" />
              Call
            </a>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-muted text-foreground flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors"
                data-testid="whatsapp-guest-button"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </div>
        )}

        <div className="border-border grid grid-cols-2 gap-3 border-t pt-3 text-xs">
          <div>
            <span className="text-muted-foreground">Service Type</span>
            <p className="text-foreground font-semibold capitalize">{currentOrder.serviceType}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Requested Timing</span>
            <p className="text-foreground flex items-center gap-1 font-semibold">
              <Clock className="h-3.5 w-3.5" />
              {currentOrder.requestedTime ? currentOrder.requestedTime : "ASAP"}
            </p>
          </div>
        </div>

        {currentOrder.deliveryAddress && (
          <div className="border-border border-t pt-2.5 text-xs">
            <span className="text-muted-foreground">Delivery Address</span>
            <p className="text-foreground flex items-start gap-1 pt-0.5 font-semibold">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {currentOrder.deliveryAddress}
            </p>
          </div>
        )}
      </div>

      {/* Order Items & Totals Card */}
      <div
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
        data-testid="order-items-card"
      >
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
            Order Items ({currentOrder.items.reduce((s, it) => s + it.quantity, 0)})
          </span>
        </div>

        <div className="divide-border flex flex-col divide-y">
          {currentOrder.items.map((item) => (
            <div
              key={item.id ?? item.productId}
              className="flex items-center justify-between py-2.5"
            >
              <div className="flex flex-col">
                <span className="text-foreground text-sm font-medium">
                  {item.quantity}× {item.productName}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatMoney(item.unitPrice)} each
                </span>
              </div>
              <span className="text-foreground text-sm font-semibold tabular-nums">
                {formatMoney(item.totalPrice)}
              </span>
            </div>
          ))}
        </div>

        {currentOrder.notes && (
          <div className="bg-warning-soft/40 border-warning-soft text-warning-soft-foreground rounded-lg border p-3 text-xs">
            <span className="font-semibold">Special Notes:</span> {currentOrder.notes}
          </div>
        )}

        <div className="border-border flex items-center justify-between border-t pt-3">
          <span className="text-muted-foreground text-sm font-medium">Total</span>
          <span className="text-display-sm text-foreground font-bold tabular-nums">
            {formatMoney(currentOrder.totalAmount)}
          </span>
        </div>
      </div>

      {/* Payment Card */}
      <div
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
        data-testid="payment-card"
      >
        <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
          Payment
        </span>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentOrder.paid === "paid" ? (
              <Badge variant="paid" className="gap-1.5 py-1 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Paid
              </Badge>
            ) : (
              <Badge variant="unpaid" className="gap-1.5 py-1 text-sm font-semibold">
                <AlertCircle className="h-4 w-4" />
                Unpaid
              </Badge>
            )}
            <span className="text-muted-foreground text-xs uppercase">
              Preference: {currentOrder.paymentPreference.replace("_", " ")}
            </span>
          </div>

          {currentOrder.paid === "unpaid" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaymentDialogOpen(true)}
              className="text-primary hover:bg-primary-soft/50 font-semibold"
              data-testid="record-payment-button"
            >
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Record payment
            </Button>
          )}
        </div>

        {currentOrder.paid === "paid" && currentOrder.paymentMethod && (
          <p className="text-muted-foreground text-xs">
            Method: <strong className="capitalize">{currentOrder.paymentMethod}</strong>
            {currentOrder.paidAt && ` • Paid at ${formatTime(currentOrder.paidAt)}`}
          </p>
        )}
      </div>

      {/* Status History Timeline Card */}
      <div
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
        data-testid="order-timeline-card"
      >
        <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
          Status History Timeline
        </span>

        <div className="before:bg-border relative space-y-4 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5">
          {(currentOrder.statusHistory && currentOrder.statusHistory.length > 0
            ? currentOrder.statusHistory
            : [{ status: currentOrder.status, timestamp: currentOrder.createdAt, note: null }]
          ).map((event, idx) => (
            <div key={idx} className="relative flex flex-col gap-0.5">
              <div
                className={cn(
                  "border-card absolute top-1 -left-6 h-3.5 w-3.5 rounded-full border-2",
                  event.status === currentOrder.status ? "bg-primary" : "bg-muted-foreground/60",
                )}
              />
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_BADGE_MAP[event.status] ?? "default"}>{event.status}</Badge>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatTime(event.timestamp)} • {formatDate(event.timestamp, "en", "short")}
                </span>
              </div>
              {event.note && <p className="text-muted-foreground pt-0.5 text-xs">{event.note}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      {currentOrder.status !== "COMPLETED" && currentOrder.status !== "CANCELLED" && (
        <div
          className="border-border bg-card/95 fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
          data-testid="order-actions-bar"
        >
          {isReadyUnpaid && (
            <div className="bg-warning-soft text-warning-soft-foreground flex items-center gap-2 rounded-lg p-2 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Payment required before completing order handover.</span>
            </div>
          )}

          <div className="flex gap-2">
            {nextStep && (
              <Button
                type="button"
                onClick={handleProgressStatus}
                disabled={isSubmitting || (nextStep.nextStatus === "COMPLETED" && isUnpaid)}
                className="bg-primary text-primary-foreground min-h-12 flex-1 text-base font-semibold shadow-sm"
                data-testid="next-status-action-button"
              >
                <nextStep.icon className="mr-2 h-5 w-5" />
                {nextStep.label}
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(true)}
              disabled={isSubmitting}
              className="border-destructive text-destructive hover:bg-destructive/10 min-h-12 font-medium"
              data-testid="cancel-order-button"
            >
              <Ban className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

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

          <div className="flex flex-col gap-2 py-2">
            <label className="text-foreground text-sm font-medium">
              Cancellation Reason (optional)
            </label>
            <Textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="e.g. Customer requested, kitchen issue..."
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
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={isSubmitting}
              data-testid="confirm-cancel-button"
            >
              Confirm cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent data-testid="record-payment-dialog">
          <DialogHeader>
            <DialogTitle>Record Payment for Order #{currentOrder.orderNumber}</DialogTitle>
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
                  "flex min-h-11 items-center justify-between rounded-lg border p-3 text-sm font-semibold capitalize transition-colors",
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
    </div>
  );
}
