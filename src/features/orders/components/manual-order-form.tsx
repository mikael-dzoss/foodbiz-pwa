"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, User, MapPin, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { formatMoney } from "@/domain";
import type { Product, Guest } from "@/domain";
import { createManualOrderAction, lookupGuestByPhoneAction } from "../order-actions";
import { cn } from "@/lib/utils";

export interface ManualOrderFormProps {
  products: Product[];
}

export function ManualOrderForm({ products }: ManualOrderFormProps) {
  const router = useRouter();

  // Guest State
  const [guestPhone, setGuestPhone] = React.useState("");
  const [guestName, setGuestName] = React.useState("");
  const [matchedGuest, setMatchedGuest] = React.useState<Guest | null>(null);
  const [isLookingUpGuest, setIsLookingUpGuest] = React.useState(false);

  // Service & Timing State
  const [serviceType, setServiceType] = React.useState<"pickup" | "delivery" | "dine-in">("pickup");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [channel, setChannel] = React.useState<"phone" | "whatsapp" | "in-person">("phone");
  const [isAsap, setIsAsap] = React.useState(true);
  const [requestedDate, setRequestedDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [requestedTime, setRequestedTime] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [paymentPreference, setPaymentPreference] = React.useState<
    "on_handover" | "revolut" | "wero"
  >("on_handover");

  // Selected Product Quantities: Map productId -> quantity
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = React.useState("");

  // Submission State
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Phone lookup handler
  const handlePhoneBlur = async () => {
    if (!guestPhone || guestPhone.trim().length < 4) return;
    setIsLookingUpGuest(true);
    const res = await lookupGuestByPhoneAction(guestPhone);
    setIsLookingUpGuest(false);

    if (res.success && res.data) {
      setMatchedGuest(res.data);
      setGuestName(res.data.name);
      if (res.data.address && !deliveryAddress) {
        setDeliveryAddress(res.data.address);
      }
    } else {
      setMatchedGuest(null);
    }
  };

  const handleQuantityChange = (productId: string, qty: number) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: qty,
    }));
  };

  // Compute selected items and total
  const selectedItems = React.useMemo(() => {
    return products
      .filter((p) => (quantities[p.id] ?? 0) > 0)
      .map((p) => ({
        product: p,
        quantity: quantities[p.id]!,
        lineTotal: p.price * quantities[p.id]!,
      }));
  }, [products, quantities]);

  const totalAmount = selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  // Filter products by search
  const displayedProducts = React.useMemo(() => {
    if (!productSearch.trim()) return products.filter((p) => p.visible);
    const q = productSearch.toLowerCase().trim();
    return products.filter((p) => p.visible && p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      setErrorMessage("Please select at least one product with a quantity.");
      return;
    }

    if (!guestName.trim()) {
      setErrorMessage("Please provide guest name.");
      return;
    }

    if (!guestPhone.trim()) {
      setErrorMessage("Please provide guest phone number.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      guestPhone: guestPhone.trim(),
      guestName: guestName.trim(),
      deliveryAddress: serviceType === "delivery" ? deliveryAddress.trim() : null,
      serviceType,
      channel,
      isAsap,
      requestedDate: isAsap ? undefined : requestedDate,
      requestedTime: isAsap || !requestedTime ? null : requestedTime,
      notes: notes.trim() || null,
      paymentPreference,
      items: selectedItems.map((it) => ({
        productId: it.product.id,
        quantity: it.quantity,
      })),
    };

    const res = await createManualOrderAction(payload);
    setIsSubmitting(false);

    if (res.success) {
      router.push(`/manage/orders/${res.data.id}`);
    } else {
      setErrorMessage(res.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 pb-36"
      data-testid="manual-order-form"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <Link
          href="/manage/orders"
          className="text-primary hover:text-primary/80 flex items-center gap-1.5 text-sm font-semibold transition-colors"
          data-testid="back-orders-link"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Orders</span>
        </Link>
        <Badge variant="outline" className="text-xs uppercase">
          Manual Order
        </Badge>
      </div>

      <div>
        <h1 className="text-display-sm text-foreground font-bold">New Order</h1>
        <p className="text-body-sm text-muted-foreground">
          Record customer phone, WhatsApp, or in-person order directly
        </p>
      </div>

      {errorMessage && (
        <div
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-sm"
          role="alert"
          data-testid="manual-order-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Guest Information Card */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
            Step 1: Guest Information
          </span>
          {matchedGuest && (
            <Badge variant="success" className="gap-1 text-xs" data-testid="guest-matched-badge">
              <CheckCircle2 className="h-3 w-3" />
              Existing Guest
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="guestPhone" className="text-foreground text-xs font-semibold">
            Phone Number <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Phone className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="guestPhone"
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              onBlur={handlePhoneBlur}
              placeholder="+33 6 12 34 56 78"
              className="pl-9 text-base"
              required
              data-testid="guest-phone-input"
            />
          </div>
          {isLookingUpGuest && (
            <span className="text-muted-foreground text-xs">Checking guest database...</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="guestName" className="text-foreground text-xs font-semibold">
            Guest Name <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              id="guestName"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. Jean Dupont"
              className="pl-9 text-base"
              required
              data-testid="guest-name-input"
            />
          </div>
        </div>

        {/* Channel Selection */}
        <div className="flex flex-col gap-1.5 pt-1">
          <label className="text-foreground text-xs font-semibold">Channel</label>
          <div className="grid grid-cols-3 gap-2">
            {(["phone", "whatsapp", "in-person"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-lg border text-xs font-semibold capitalize transition-all",
                  channel === ch
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
                data-testid={`channel-${ch}`}
              >
                {ch.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 2: Service & Timing Card */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
          Step 2: Service & Timing
        </span>

        {/* Service Type */}
        <div className="grid grid-cols-3 gap-2">
          {(["pickup", "delivery", "dine-in"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setServiceType(st)}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-lg border text-xs font-semibold capitalize transition-all",
                serviceType === st
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
              data-testid={`service-type-${st}`}
            >
              {st}
            </button>
          ))}
        </div>

        {serviceType === "delivery" && (
          <div className="flex flex-col gap-1.5 pt-1">
            <label htmlFor="deliveryAddress" className="text-foreground text-xs font-semibold">
              Delivery Address <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <MapPin className="text-muted-foreground pointer-events-none absolute top-3 left-3 h-4 w-4" />
              <Textarea
                id="deliveryAddress"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="123 Rue de la Paix, Paris..."
                className="min-h-20 pl-9"
                required
                data-testid="delivery-address-input"
              />
            </div>
          </div>
        )}

        {/* Timing */}
        <div className="flex flex-col gap-2 pt-1">
          <label className="text-foreground text-xs font-semibold">Fulfillment Time</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsAsap(true)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all",
                isAsap
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
              data-testid="timing-asap"
            >
              <Clock className="h-4 w-4" />
              ASAP
            </button>
            <button
              type="button"
              onClick={() => setIsAsap(false)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-all",
                !isAsap
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
              data-testid="timing-scheduled"
            >
              Scheduled
            </button>
          </div>

          {!isAsap && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="h-11"
                data-testid="requested-date-input"
              />
              <Input
                type="time"
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                placeholder="19:30"
                className="h-11"
                data-testid="requested-time-input"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5 pt-1">
          <label htmlFor="notes" className="text-foreground text-xs font-semibold">
            Special Requests & Notes (optional)
          </label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, sauces, instructions..."
            className="min-h-16 text-sm"
            data-testid="order-notes-input"
          />
        </div>
      </div>

      {/* Step 3: Product Selection & Quantities Card */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
            Step 3: Product Selection
          </span>
          <span className="text-muted-foreground text-xs">{selectedItems.length} selected</span>
        </div>

        <Input
          type="search"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder="Filter products..."
          className="h-10 text-sm"
        />

        <div className="divide-border flex flex-col divide-y">
          {displayedProducts.map((product) => {
            const currentQty = quantities[product.id] ?? 0;
            const isOutOfStock = product.stock <= 0;

            return (
              <div
                key={product.id}
                className="flex items-center justify-between py-3"
                data-testid={`product-row-${product.id}`}
              >
                <div className="flex flex-col">
                  <span className="text-foreground text-sm font-semibold">{product.name}</span>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                      {formatMoney(product.price)}
                    </span>
                    <Badge
                      variant={
                        isOutOfStock ? "destructive" : product.stock <= 5 ? "warning" : "outline"
                      }
                      className="py-0 text-[10px]"
                    >
                      {isOutOfStock ? "Out of stock" : `${product.stock} in stock`}
                    </Badge>
                  </div>
                </div>

                <QuantityStepper
                  value={currentQty}
                  min={0}
                  max={product.stock}
                  onChange={(val) => handleQuantityChange(product.id, val)}
                  data-testid={`stepper-${product.id}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 4: Order Summary Card */}
      <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4">
        <span className="text-caption text-muted-foreground font-semibold tracking-wider uppercase">
          Step 4: Order Summary
        </span>

        {selectedItems.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-xs">
            No items added yet. Pick quantities above.
          </p>
        ) : (
          <div className="divide-border flex flex-col divide-y text-sm">
            {selectedItems.map((it) => (
              <div key={it.product.id} className="flex justify-between py-1.5">
                <span className="text-foreground">
                  {it.quantity}× {it.product.name}
                </span>
                <span className="text-foreground font-semibold tabular-nums">
                  {formatMoney(it.lineTotal)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Payment preference */}
        <div className="border-border flex flex-col gap-1.5 border-t pt-2">
          <label className="text-foreground text-xs font-semibold">Payment Preference</label>
          <div className="grid grid-cols-3 gap-2">
            {(["on_handover", "revolut", "wero"] as const).map((pref) => (
              <button
                key={pref}
                type="button"
                onClick={() => setPaymentPreference(pref)}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-lg border text-xs font-semibold uppercase transition-all",
                  paymentPreference === pref
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
                data-testid={`preference-${pref}`}
              >
                {pref.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-3">
          <span className="text-muted-foreground text-sm font-medium">Total</span>
          <span className="text-display-sm text-foreground font-bold tabular-nums">
            {formatMoney(totalAmount)}
          </span>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div
        className="border-border bg-card/95 fixed inset-x-0 bottom-0 z-30 flex flex-col gap-1.5 border-t p-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
        data-testid="manual-order-bottom-bar"
      >
        <Button
          type="submit"
          disabled={isSubmitting || selectedItems.length === 0}
          className="bg-primary text-primary-foreground min-h-12 w-full text-base font-semibold shadow-sm"
          data-testid="create-order-submit-button"
        >
          {isSubmitting ? "Creating order..." : `Create Order (${formatMoney(totalAmount)})`}
        </Button>
        <p className="text-muted-foreground text-center text-[11px]">
          Created as CONFIRMED • Stock decremented automatically
        </p>
      </div>
    </form>
  );
}
