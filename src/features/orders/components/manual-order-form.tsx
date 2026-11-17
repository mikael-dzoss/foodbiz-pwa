"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  User,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Check,
  Pencil,
  ShoppingBag,
  Truck,
  MessageSquare,
  Store,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionBar } from "@/components/ui/action-bar";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { useToast } from "@/components/ui/toast";
import {
  formatCalendarDate,
  formatMoney,
  isValidGuestName,
  isValidPhoneNumber,
  normalizeGuestName,
} from "@/domain";
import type { Product } from "@/domain";
import {
  createManualOrderAction,
  lookupGuestByPhoneAction,
  type GuestPrefill,
} from "../order-actions";
import { cn } from "@/lib/utils";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";

function useSafeToast() {
  try {
    return useToast();
  } catch {
    return { showToast: () => {} };
  }
}

export interface ManualOrderFormProps {
  products: Product[];
  /** Today on the business calendar (YYYY-MM-DD): the default scheduled date. */
  today: string;
}

export function ManualOrderForm({ products, today }: ManualOrderFormProps) {
  const { locale, dict } = useManagerLocale();
  const o = dict.orders;
  const t = o.manual;
  const router = useRouter();
  const { showToast } = useSafeToast();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const nameInputRef = React.useRef<HTMLInputElement | null>(null);

  // Guest State
  const [guestPhone, setGuestPhone] = React.useState("");
  const [guestName, setGuestName] = React.useState("");
  const [matchedGuest, setMatchedGuest] = React.useState<GuestPrefill | null>(null);
  const [isNameLocked, setIsNameLocked] = React.useState(false);
  const [isNameUnlockedByUser, setIsNameUnlockedByUser] = React.useState(false);
  const [nameEditNotice, setNameEditNotice] = React.useState<string | null>(null);
  const [isLookingUpGuest, setIsLookingUpGuest] = React.useState(false);

  // Service & Timing State (strictly pickup and delivery)
  const [serviceType, setServiceType] = React.useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [channel, setChannel] = React.useState<"phone" | "whatsapp" | "in-person">("phone");
  const [isAsap, setIsAsap] = React.useState(true);
  const [requestedDate, setRequestedDate] = React.useState(today);
  const [requestedTime, setRequestedTime] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [paymentPreference] = React.useState<"on_handover" | "revolut" | "wero">("on_handover");

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

    if (res.ok && res.data) {
      setMatchedGuest(res.data);
      setGuestName(res.data.name);
      setIsNameLocked(true);
      setIsNameUnlockedByUser(false);
      setNameEditNotice(null);
      if (res.data.address && !deliveryAddress) {
        setDeliveryAddress(res.data.address);
      }
    } else {
      setMatchedGuest(null);
      setIsNameLocked(false);
      setIsNameUnlockedByUser(false);
      setNameEditNotice(null);
    }
  };

  const handleUnlockGuestName = () => {
    setIsNameLocked(false);
    setIsNameUnlockedByUser(true);
    setNameEditNotice(t.nameEditNotice);
    showToast(t.nameEditNotice);
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
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

  const totalItemCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = selectedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  const isPhoneSyntaxValid = isValidPhoneNumber(guestPhone);
  const isNameSyntaxValid = isValidGuestName(guestName);
  const isDeliveryValid = serviceType !== "delivery" || deliveryAddress.trim().length > 0;
  const isTimingValid = isAsap || Boolean(requestedDate);
  const canPreview =
    totalItemCount > 0 &&
    isPhoneSyntaxValid &&
    isNameSyntaxValid &&
    isDeliveryValid &&
    isTimingValid;

  // Filter products by search
  const displayedProducts = React.useMemo(() => {
    let list = products.filter((p) => p.visible);
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, productSearch]);

  const validateBeforePreviewOrSubmit = (): boolean => {
    if (selectedItems.length === 0) {
      setErrorMessage(t.errors.noItems);
      return false;
    }

    if (!guestPhone.trim() || !isValidPhoneNumber(guestPhone)) {
      setErrorMessage(t.errors.invalidPhone);
      return false;
    }

    if (!guestName.trim() || !isValidGuestName(guestName)) {
      setErrorMessage(t.errors.invalidName);
      return false;
    }

    if (serviceType === "delivery" && !deliveryAddress.trim()) {
      setErrorMessage(t.errors.noAddress);
      return false;
    }

    return true;
  };

  const handleOpenPreview = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateBeforePreviewOrSubmit()) return;

    setErrorMessage(null);
    setPreviewOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!validateBeforePreviewOrSubmit()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const normalizedSubmittedName = normalizeGuestName(guestName);
    const updateGuestName = Boolean(
      matchedGuest && isNameUnlockedByUser && normalizedSubmittedName !== matchedGuest.name,
    );

    const payload = {
      guestPhone: guestPhone.trim(),
      guestName: normalizedSubmittedName,
      updateGuestName,
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

    if (res.ok) {
      setPreviewOpen(false);
      router.push(`/manage/orders/${res.data.id}`);
    } else {
      setErrorMessage(actionErrorMessage(res, locale));
    }
  };

  // Guest initials
  const initials = guestName
    ? guestName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G";

  return (
    <form
      onSubmit={handleOpenPreview}
      className="flex flex-col gap-3.5 pb-36"
      data-testid="manual-order-form"
    >
      {/* Top Header: Matching Stitch M-30 */}
      <header className="flex items-center justify-between pt-1">
        <Link
          href="/manage/orders"
          className="text-foreground hover:text-primary flex items-center gap-1 text-sm font-semibold transition-colors"
          data-testid="cancel-header-link"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t.back}</span>
        </Link>

        <div className="flex flex-col items-center text-center">
          <h1 className="text-title-md text-foreground">{t.title}</h1>
          <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
            {t.screenTag}
          </span>
        </div>

        <Link href="/manage/orders">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border bg-card text-foreground hover:bg-muted h-8 rounded-lg px-3 text-xs font-semibold"
            data-testid="cancel-header-button"
          >
            {t.cancel}
          </Button>
        </Link>
      </header>

      {errorMessage && (
        <div
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-xs"
          role="alert"
          data-testid="manual-order-error"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step 1: Guest Information Card (Matching Stitch M-30) */}
      <section className="bg-card border-border space-y-3 rounded-xl border p-3.5 shadow-none">
        <div className="border-border/60 flex items-center justify-between gap-3 border-b pb-2">
          <div className="flex items-center gap-2">
            <span className="bg-primary-soft text-primary-soft-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {1}
            </span>
            <h2 className="text-title-sm text-foreground">{t.step1}</h2>
          </div>
          {matchedGuest && (
            <span className="text-primary flex items-center gap-1 text-xs font-medium">
              <CheckCircle2 className="fill-primary text-card h-3.5 w-3.5" />
              {t.verified}
            </span>
          )}
        </div>

        {/* Phone Input with Auto-lookup */}
        <div className="space-y-1">
          <label htmlFor="guestPhone" className="text-muted-foreground block text-xs font-medium">
            {t.phoneLabel} <span className="text-destructive">*</span>
          </label>
          <div className="relative flex items-center">
            <Phone className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
            <Input
              id="guestPhone"
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              onBlur={handlePhoneBlur}
              placeholder="+33 6 12 34 56 78"
              className="bg-card h-11 rounded-lg pr-9 pl-9 text-sm tabular-nums"
              required
              data-testid="guest-phone-input"
            />
            {matchedGuest && (
              <Check className="text-primary pointer-events-none absolute right-3 h-4 w-4" />
            )}
          </div>
          {isLookingUpGuest && (
            <span className="text-muted-foreground text-caption">{t.lookingUp}</span>
          )}
        </div>

        {/* Found Guest Profile Card (Stitch M-30) */}
        {matchedGuest && (
          <div className="bg-muted/40 border-border/80 flex items-center justify-between rounded-lg border p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold">
                {initials}
              </div>
              <div>
                <div className="text-foreground text-xs font-bold">{matchedGuest.name}</div>
                <div className="text-muted-foreground text-caption">{t.returningGuest}</div>
              </div>
            </div>
            <span
              data-testid="guest-matched-badge"
              className="bg-primary-soft text-primary-soft-foreground border-primary/20 text-caption inline-flex items-center rounded border px-2 py-0.5 font-medium"
            >
              {t.returningGuest}
            </span>
          </div>
        )}

        {/* Guest Name input */}
        <div className="space-y-1">
          <label htmlFor="guestName" className="text-muted-foreground block text-xs font-medium">
            {t.nameLabel} <span className="text-destructive">*</span>
          </label>
          <div className="relative flex items-center">
            <User className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
            <Input
              ref={nameInputRef}
              id="guestName"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={t.namePlaceholder}
              disabled={isNameLocked}
              minLength={2}
              maxLength={50}
              className={cn(
                "bg-card h-11 rounded-lg pl-9 text-sm",
                isNameLocked && "pr-11 opacity-80",
              )}
              required
              data-testid="guest-name-input"
            />
            {matchedGuest && isNameLocked && (
              <Button
                variant="unstyled"
                size="none"
                type="button"
                onClick={handleUnlockGuestName}
                aria-label={t.editName}
                data-testid="unlock-guest-name-button"
                className="text-muted-foreground hover:text-foreground hover:bg-muted absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          {nameEditNotice && (
            <div
              role="status"
              data-testid="guest-name-update-toast"
              className="bg-warning-soft text-warning-soft-foreground border-warning/30 text-caption rounded-md border px-2.5 py-1.5 font-medium"
            >
              {nameEditNotice}
            </div>
          )}
        </div>

        {/* Channel Selector Chips (Phone, WhatsApp, In-person with icons) */}
        <div>
          <p
            id="intake-channel-label"
            className="text-muted-foreground text-caption mb-1.5 block font-medium"
          >
            {t.intakeChannel}
          </p>
          <div
            role="group"
            aria-labelledby="intake-channel-label"
            className="grid grid-cols-3 gap-1.5"
          >
            {(
              [
                { id: "phone", label: o.channels.phone, icon: Phone },
                { id: "whatsapp", label: o.channels.whatsapp, icon: MessageSquare },
                { id: "in-person", label: o.channels["in-person"], icon: Store },
              ] as const
            ).map((ch) => (
              <Button
                variant="unstyled"
                size="none"
                key={ch.id}
                type="button"
                onClick={() => setChannel(ch.id)}
                aria-pressed={channel === ch.id}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold whitespace-nowrap transition-all active:scale-95",
                  channel === ch.id
                    ? "border-primary bg-primary-soft text-primary-soft-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
                data-testid={`channel-${ch.id}`}
              >
                <ch.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{ch.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Step 2: Service & Timing Card (Matching Stitch M-30) */}
      <section className="bg-card border-border space-y-3 rounded-xl border p-3.5 shadow-none">
        <div className="border-border/60 flex items-center justify-between gap-3 border-b pb-2">
          <div className="flex items-center gap-2">
            <span className="bg-primary-soft text-primary-soft-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {2}
            </span>
            <h2 className="text-title-sm text-foreground">{t.step2}</h2>
          </div>
          <span className="text-muted-foreground shrink-0 text-xs capitalize">
            {interpolate(t.fulfillment, { service: o.service[serviceType] })}
          </span>
        </div>

        {/* Service Segmented Control: Strictly Pickup vs Delivery */}
        <SegmentedControl
          aria-label={t.serviceType}
          value={serviceType}
          onValueChange={setServiceType}
          className="items-center rounded-lg p-0.5"
          optionClassName="min-h-9 gap-1 rounded-md py-1.5 text-xs font-semibold"
          selectedClassName="bg-card text-primary font-bold shadow-xs"
          options={[
            {
              value: "pickup",
              "data-testid": "service-type-pickup",
              label: (
                <>
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>{o.service.pickup}</span>
                </>
              ),
            },
            {
              value: "delivery",
              "data-testid": "service-type-delivery",
              label: (
                <>
                  <Truck className="h-3.5 w-3.5" />
                  <span>{o.service.delivery}</span>
                </>
              ),
            },
          ]}
        />

        {/* Timing Options: ASAP vs Scheduled (2-card selector matching Stitch M-30) */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="unstyled"
            size="none"
            type="button"
            onClick={() => setIsAsap(true)}
            className={cn(
              "flex flex-col justify-between rounded-lg border p-2.5 text-left transition-all",
              isAsap
                ? "border-primary bg-primary-soft/40 border-2"
                : "border-border bg-card hover:bg-muted/40",
            )}
            data-testid="timing-asap"
          >
            <div className="mb-1 flex w-full items-center justify-between">
              <span
                className={cn("text-xs font-bold", isAsap ? "text-primary" : "text-foreground")}
              >
                {t.asap}
              </span>
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  isAsap ? "bg-primary" : "border-muted-foreground border",
                )}
              />
            </div>
            <span className="text-muted-foreground text-caption font-medium">{t.estimate}</span>
          </Button>

          <Button
            variant="unstyled"
            size="none"
            type="button"
            onClick={() => setIsAsap(false)}
            className={cn(
              "flex flex-col justify-between rounded-lg border p-2.5 text-left transition-all",
              !isAsap
                ? "border-primary bg-primary-soft/40 border-2"
                : "border-border bg-card hover:bg-muted/40",
            )}
            data-testid="timing-scheduled"
          >
            <div className="mb-1 flex w-full items-center justify-between">
              <span
                className={cn("text-xs font-bold", !isAsap ? "text-primary" : "text-foreground")}
              >
                {t.scheduled}
              </span>
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  !isAsap ? "bg-primary" : "border-muted-foreground border",
                )}
              />
            </div>
            <span className="text-muted-foreground text-caption font-medium">
              {t.selectDateTime}
            </span>
          </Button>
        </div>

        {/* Date and Time pickers when Scheduled */}
        {!isAsap && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <label
                htmlFor="reqDate"
                className="text-muted-foreground text-caption block font-medium"
              >
                {t.date}
              </label>
              <Input
                id="reqDate"
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className="h-10 text-xs"
                data-testid="requested-date-input"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="reqTime"
                className="text-muted-foreground text-caption block font-medium"
              >
                {t.time}
              </label>
              <Input
                id="reqTime"
                type="time"
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                className="h-10 text-xs"
                data-testid="requested-time-input"
              />
            </div>
          </div>
        )}

        {/* Delivery Address when Delivery is selected */}
        {serviceType === "delivery" && (
          <div className="space-y-1 pt-1">
            <label
              htmlFor="deliveryAddress"
              className="text-muted-foreground block text-xs font-medium"
            >
              {t.deliveryAddress} <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <MapPin className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 h-4 w-4" />
              <Textarea
                id="deliveryAddress"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t.addressPlaceholder}
                className="min-h-16 resize-none rounded-lg pl-8 text-xs"
                required
                data-testid="delivery-address-input"
              />
            </div>
          </div>
        )}

        {/* Kitchen & Handover Notes */}
        <div className="space-y-1">
          <label htmlFor="orderNotes" className="text-muted-foreground block text-xs font-medium">
            {t.notesLabel}
          </label>
          <Textarea
            id="orderNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notesPlaceholder}
            className="resize-none rounded-lg text-xs"
            rows={2}
            data-testid="order-notes-input"
          />
        </div>
      </section>

      {/* Step 3: Product Selection & Quantities Card (Matching Stitch M-30) */}
      <section className="bg-card border-border space-y-3 rounded-xl border p-3.5 shadow-none">
        <div className="border-border/60 flex items-center justify-between gap-3 border-b pb-2">
          <div className="flex items-center gap-2">
            <span className="bg-primary-soft text-primary-soft-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {3}
            </span>
            <h2 className="text-title-sm text-foreground">{t.step3}</h2>
          </div>
          <span className="text-muted-foreground shrink-0 text-xs font-medium tabular-nums">
            {interpolate(t.selectedCount, { count: totalItemCount })}
          </span>
        </div>

        {/* Product Search */}
        <Input
          type="search"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="h-10 rounded-lg text-xs"
        />

        {/* Product List */}
        <div className="space-y-1.5">
          {displayedProducts.map((product) => {
            const currentQty = quantities[product.id] ?? 0;
            const isOutOfStock = product.stock <= 0;

            return (
              <div
                key={product.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-all",
                  currentQty > 0
                    ? "bg-primary-soft/50 border-primary/30"
                    : "border-border/60 bg-card hover:bg-muted/30",
                )}
                data-testid={`product-row-${product.id}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-foreground truncate text-sm font-semibold">
                    {product.name}
                  </span>
                  <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                    <span className="text-foreground font-medium tabular-nums">
                      {formatMoney(product.price, locale)}
                    </span>
                    <span>•</span>
                    {isOutOfStock ? (
                      <span className="bg-destructive/15 text-destructive border-destructive/25 text-micro inline-flex items-center rounded-full border px-2 py-0.5 font-bold">
                        {t.outOfStock}
                      </span>
                    ) : product.stock <= 5 ? (
                      <span className="bg-warning-soft text-warning-soft-foreground border-warning/30 text-micro inline-flex items-center rounded-full border px-2 py-0.5 font-bold tabular-nums">
                        {interpolate(t.inStockLow, { count: product.stock })}
                      </span>
                    ) : (
                      <span className="bg-primary-soft text-primary-soft-foreground border-primary/20 text-micro inline-flex items-center rounded-full border px-2 py-0.5 font-semibold tabular-nums">
                        {interpolate(t.inStock, { count: product.stock })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <QuantityStepper
                    value={currentQty}
                    min={0}
                    max={isOutOfStock ? 0 : product.stock}
                    onChange={(val) => handleQuantityChange(product.id, val)}
                    decreaseLabel={dict.common.decreaseQuantity}
                    increaseLabel={dict.common.increaseQuantity}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sticky Bottom Order Summary Bar (Z-50) */}
      <ActionBar
        placement="bottom"
        className="pb-safe-3.5 z-50 mx-auto max-w-xl px-3.5 pt-3.5"
        contentClassName="max-w-none justify-between"
        data-testid="manual-order-bottom-bar"
      >
        <span className="sr-only">{t.step4}</span>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-caption font-medium">
            {interpolate(totalItemCount === 1 ? o.itemOne : o.itemOther, {
              count: totalItemCount,
            })}
          </span>
          <span className="text-foreground text-base font-bold tabular-nums">
            {formatMoney(totalAmount, locale)}
          </span>
        </div>

        <Button
          type="button"
          onClick={handleOpenPreview}
          disabled={isSubmitting || !canPreview}
          className="bg-primary text-primary-foreground min-h-11 rounded-lg px-5 text-xs font-semibold shadow-none active:scale-95"
          data-testid="create-order-submit-button"
        >
          {totalAmount > 0
            ? interpolate(t.previewCreateAmount, { amount: formatMoney(totalAmount, locale) })
            : t.previewCreate}
        </Button>
      </ActionBar>

      {/* Read-Only Order Preview Modal Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          className="max-h-[85vh] max-w-md overflow-y-auto"
          data-testid="order-preview-dialog"
        >
          <DialogHeader>
            <DialogTitle>{t.preview.title}</DialogTitle>
            <DialogDescription>{t.preview.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            {/* Guest Details */}
            <div className="bg-muted/60 space-y-1 rounded-lg p-3">
              <span className="text-muted-foreground text-micro font-bold tracking-wider uppercase">
                {t.preview.guestChannel}
              </span>
              <p className="text-foreground text-sm font-semibold">
                {guestName || t.preview.noName}
              </p>
              <p className="text-muted-foreground">
                {interpolate(t.preview.via, {
                  phone: guestPhone || t.preview.noPhone,
                  channel: o.channels[channel],
                })}
              </p>
            </div>

            {/* Service & Timing */}
            <div className="bg-muted/60 space-y-1 rounded-lg p-3">
              <span className="text-muted-foreground text-micro font-bold tracking-wider uppercase">
                {t.preview.fulfillment}
              </span>
              <p className="text-foreground font-semibold capitalize">
                {o.service[serviceType]}{" "}
                {isAsap
                  ? t.preview.asapEstimate
                  : interpolate(t.preview.scheduledFor, {
                      date: formatCalendarDate(requestedDate, locale, "medium"),
                      time: requestedTime || t.preview.anytime,
                    })}
              </p>
              {serviceType === "delivery" && (
                <p className="text-muted-foreground">
                  {interpolate(t.preview.address, {
                    address: deliveryAddress || t.preview.noAddress,
                  })}
                </p>
              )}
            </div>

            {/* Notes */}
            {notes.trim() && (
              <div className="bg-warning-soft text-warning-soft-foreground border-warning/30 rounded-lg border p-2.5">
                <span className="font-bold">{t.preview.kitchenNote}</span> {notes}
              </div>
            )}

            {/* Itemized summary */}
            <div className="border-border space-y-1.5 border-t pt-2">
              <span className="text-muted-foreground text-micro font-bold tracking-wider uppercase">
                {interpolate(t.preview.selectedProducts, { count: totalItemCount })}
              </span>
              {selectedItems.length === 0 ? (
                <p className="text-muted-foreground py-1 italic">{t.preview.noItems}</p>
              ) : (
                <div className="divide-border/60 divide-y">
                  {selectedItems.map((it) => (
                    <div key={it.product.id} className="flex items-center justify-between py-1.5">
                      <span>
                        <strong className="text-primary font-bold">{it.quantity}×</strong>{" "}
                        {it.product.name}
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatMoney(it.lineTotal, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="border-border flex items-center justify-between border-t pt-2 text-sm font-bold">
              <span>{t.preview.totalAmount}</span>
              <span className="text-primary text-base tabular-nums">
                {formatMoney(totalAmount, locale)}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              {t.preview.backToEdit}
            </Button>
            <Button
              type="button"
              disabled={
                isSubmitting || totalItemCount === 0 || !guestName.trim() || !guestPhone.trim()
              }
              onClick={(e) => {
                handleSubmit(e);
              }}
              className="bg-primary text-primary-foreground font-semibold"
              data-testid="confirm-create-order-button"
            >
              {isSubmitting ? t.preview.creating : t.preview.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
