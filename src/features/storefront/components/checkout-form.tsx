"use client";

import { useState, useId, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Lock,
  Pencil,
  CheckCircle2,
  Store,
  Truck,
  Clock,
  Calendar,
  CreditCard,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import type { Business, BusinessSettings } from "@/domain/business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import {
  checkoutFormSchema,
  type CheckoutFormData,
  GUEST_CONTACT_STORAGE_KEY,
  guestContactStorageSchema,
  type GuestContactStorage,
} from "@/domain/checkout";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/domain/guest";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCart } from "../context/cart-context";

const guestContactListeners = new Set<() => void>();
let cachedRawGuestContact: string | null = "__UNSET__";
let cachedParsedGuestContact: GuestContactStorage | null = null;

export function resetGuestContactCache(): void {
  cachedRawGuestContact = "__UNSET__";
  cachedParsedGuestContact = null;
  guestContactListeners.forEach((listener) => listener());
}

function subscribeGuestContact(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  guestContactListeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === GUEST_CONTACT_STORAGE_KEY) {
      cachedRawGuestContact = "__UNSET__";
      callback();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    guestContactListeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getStoredGuestContact(): GuestContactStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GUEST_CONTACT_STORAGE_KEY);
    if (raw === cachedRawGuestContact) {
      return cachedParsedGuestContact;
    }
    cachedRawGuestContact = raw;
    if (!raw) {
      cachedParsedGuestContact = null;
      return null;
    }
    const parsed = JSON.parse(raw);
    const valid = guestContactStorageSchema.safeParse(parsed);
    cachedParsedGuestContact = valid.success ? valid.data : null;
    return cachedParsedGuestContact;
  } catch {
    cachedParsedGuestContact = null;
    return null;
  }
}

export interface CheckoutFormProps {
  business: Business;
  settings: BusinessSettings | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  onSubmitOrder?: (data: CheckoutFormData) => Promise<void> | void;
}

export function CheckoutForm({
  business,
  settings,
  locale,
  dict,
  onSubmitOrder,
}: CheckoutFormProps) {
  const { items, totalAmountInCents } = useCart();

  // Zero DB Lookup: Synchronize remembered contact from local storage safely without cascading renders
  const storedContact = useSyncExternalStore(
    subscribeGuestContact,
    getStoredGuestContact,
    () => null,
  );

  // Form Field State
  const [customName, setCustomName] = useState<string | null>(null);
  const [customPhone, setCustomPhone] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const name = customName !== null ? customName : (storedContact?.name ?? "");
  const phone = customPhone !== null ? customPhone : (storedContact?.phone ?? "");
  const isNameLocked = Boolean(storedContact?.name && !isUnlocked);
  const hasLoadedFromStorage = isNameLocked;

  // Fulfillment State
  const pickupAllowed = settings?.serviceTypes.pickup ?? true;
  const deliveryAllowed = settings?.serviceTypes.delivery ?? true;
  const defaultService = pickupAllowed ? "pickup" : "delivery";
  const [serviceType, setServiceType] = useState<"pickup" | "delivery">(defaultService);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Timing State
  const [isAsap, setIsAsap] = useState(true);
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");

  // Payment State
  const revolutAllowed = settings?.paymentMethods.revolut ?? true;
  const weroAllowed = settings?.paymentMethods.wero ?? true;
  const cashAllowed = settings?.paymentMethods.cash ?? true;

  const defaultPaymentPref = cashAllowed ? "on_handover" : revolutAllowed ? "revolut" : "wero";
  const [paymentPreference, setPaymentPreference] = useState<"on_handover" | "revolut" | "wero">(
    defaultPaymentPref,
  );

  // Notes & UI State
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  // Unique IDs for accessibility
  const nameId = useId();
  const phoneId = useId();
  const addressId = useId();
  const dateId = useId();
  const timeId = useId();
  const notesId = useId();

  // Compute pricing
  const deliveryFee = serviceType === "delivery" ? (settings?.deliveryFee ?? 0) : 0;
  const finalTotal = totalAmountInCents + deliveryFee;

  // Normalized phone formatting check
  const isPhoneValid = useMemo(() => {
    if (!phone.trim()) return false;
    return isValidPhoneNumber(phone);
  }, [phone]);

  // Form Validation Preview
  const validationResult = useMemo(() => {
    let normalizedPhone = phone.trim();
    if (normalizedPhone.length > 0 && !normalizedPhone.startsWith("+")) {
      try {
        normalizedPhone = normalizePhoneNumber(normalizedPhone);
      } catch {
        // Keep raw trimmed phone for validation error
      }
    }

    const rawForm = {
      name,
      phone: normalizedPhone,
      serviceType,
      deliveryAddress: serviceType === "delivery" ? deliveryAddress : undefined,
      isAsap,
      requestedDate: isAsap ? undefined : requestedDate,
      requestedTime: isAsap ? undefined : requestedTime || undefined,
      paymentPreference,
      notes: notes || undefined,
    };
    return checkoutFormSchema.safeParse(rawForm);
  }, [
    name,
    phone,
    serviceType,
    deliveryAddress,
    isAsap,
    requestedDate,
    requestedTime,
    paymentPreference,
    notes,
  ]);

  const canSubmit = validationResult.success && items.length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validationResult.success) {
      const firstIssue = validationResult.error.issues[0];
      setErrorFeedback(firstIssue?.message || "Please check the form fields.");
      return;
    }

    setErrorFeedback(null);
    setIsSubmitting(true);

    try {
      // Persist contact details on device (local storage only, zero DB lookup)
      if (typeof window !== "undefined") {
        try {
          const contactData = {
            name: validationResult.data.name,
            phone: validationResult.data.phone,
          };
          localStorage.setItem(GUEST_CONTACT_STORAGE_KEY, JSON.stringify(contactData));
        } catch {
          // Local storage write failed (e.g. private mode)
        }
      }

      if (onSubmitOrder) {
        await onSubmitOrder(validationResult.data);
      }
      setSubmittedSuccess(true);
    } catch (err) {
      setErrorFeedback(
        err instanceof Error ? err.message : "Failed to place order. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // If order is completed or submitted in UI
  if (submittedSuccess) {
    return (
      <div
        data-testid="checkout-success-view"
        className="border-border bg-card flex flex-col items-center justify-center rounded-2xl border p-8 text-center shadow-xs"
      >
        <div className="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          {dict.orderSummary}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">{dict.securityNotice}</p>
        <div className="mt-6">
          <Button asChild size="lg" className="rounded-xl px-6">
            <Link href={`/${locale}`}>{dict.returnToCatalog}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 pb-28"
      data-testid="checkout-form"
      noValidate
    >
      {/* 1. Customer Contact (Guest) */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-base font-semibold">{dict.customerContact}</h2>
          <span className="border-border bg-muted text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs font-medium">
            {dict.guestCheckoutBadge}
          </span>
        </div>

        {/* Full Name field with Lock / Unlock affordance */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor={nameId} className="text-foreground text-xs font-medium">
              {dict.fullName} <span className="text-destructive">*</span>
            </label>
            {isNameLocked && (
              <button
                type="button"
                onClick={() => {
                  setIsUnlocked(true);
                }}
                className="text-primary hover:text-primary/80 flex items-center gap-1 text-xs font-medium transition-colors"
                aria-label={dict.editName}
                data-testid="unlock-name-button"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{dict.editName}</span>
              </button>
            )}
          </div>

          <div className="relative">
            {isNameLocked && (
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-4 w-4" />
              </div>
            )}
            <Input
              id={nameId}
              type="text"
              value={name}
              disabled={isNameLocked}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={dict.fullNamePlaceholder}
              className={isNameLocked ? "pl-9 font-medium" : ""}
              data-testid="checkout-name-input"
              required
            />
          </div>

          {/* Toast / Callout when prefilled from device memory */}
          {hasLoadedFromStorage && isNameLocked && (
            <div
              data-testid="saved-name-toast"
              className="bg-primary-soft/40 text-primary-soft-foreground border-primary-soft flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{dict.savedNameNotice}</span>
            </div>
          )}
        </div>

        {/* Mobile Phone field with E.164 validation */}
        <div className="space-y-1.5">
          <label htmlFor={phoneId} className="text-foreground text-xs font-medium">
            {dict.phone} <span className="text-destructive">*</span>
          </label>
          <Input
            id={phoneId}
            type="tel"
            value={phone}
            onChange={(e) => setCustomPhone(e.target.value)}
            placeholder={dict.phonePlaceholder}
            data-testid="checkout-phone-input"
            error={phone.length > 0 && !isPhoneValid}
            required
          />
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>{dict.phoneHelper}</span>
          </p>
        </div>
      </section>

      {/* 2. Fulfillment Mode */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <h2 className="text-foreground text-base font-semibold">{dict.fulfillmentMode}</h2>

        {/* Segmented Mode Pills */}
        <div
          className="bg-muted grid grid-cols-2 gap-1 rounded-xl p-1"
          role="radiogroup"
          aria-label={dict.fulfillmentMode}
        >
          {pickupAllowed && (
            <button
              type="button"
              role="radio"
              aria-checked={serviceType === "pickup"}
              onClick={() => setServiceType("pickup")}
              data-testid="service-pickup-button"
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                serviceType === "pickup"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store className="h-4 w-4" />
              <span>{dict.pickupFree}</span>
            </button>
          )}

          {deliveryAllowed && (
            <button
              type="button"
              role="radio"
              aria-checked={serviceType === "delivery"}
              onClick={() => setServiceType("delivery")}
              data-testid="service-delivery-button"
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                serviceType === "delivery"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>
                {dict.deliveryPaid} (
                {settings?.deliveryFee
                  ? formatMoney(settings.deliveryFee, locale)
                  : dict.serviceFree}
                )
              </span>
            </button>
          )}
        </div>

        {/* Conditional Address or Pickup Location */}
        {serviceType === "pickup" ? (
          <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3 text-xs">
            <Store className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-foreground font-semibold">{business.name}</p>
              <p className="text-muted-foreground">{business.address}</p>
              <p className="text-primary text-[11px] font-medium">• {dict.pickupLocation}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5" data-testid="delivery-address-container">
            <label htmlFor={addressId} className="text-foreground text-xs font-medium">
              {dict.deliveryAddress} <span className="text-destructive">*</span>
            </label>
            <Input
              id={addressId}
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder={dict.deliveryAddressPlaceholder}
              data-testid="checkout-address-input"
              required
            />
          </div>
        )}
      </section>

      {/* 3. Order Timing */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <h2 className="text-foreground text-base font-semibold">{dict.orderTiming}</h2>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {/* ASAP Option */}
          <label
            data-testid="timing-asap-option"
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
              isAsap
                ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                : "border-border bg-card text-muted-foreground hover:border-border/80"
            }`}
          >
            <input
              type="radio"
              name="orderTiming"
              checked={isAsap}
              onChange={() => setIsAsap(true)}
              className="text-primary mt-1 h-4 w-4"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span className="text-foreground text-sm font-semibold">{dict.asap}</span>
              </div>
              <p className="text-muted-foreground text-xs">{dict.asapEstimatedReady}</p>
            </div>
          </label>

          {/* Schedule Later Option */}
          <label
            data-testid="timing-scheduled-option"
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
              !isAsap
                ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                : "border-border bg-card text-muted-foreground hover:border-border/80"
            }`}
          >
            <input
              type="radio"
              name="orderTiming"
              checked={!isAsap}
              onChange={() => setIsAsap(false)}
              className="text-primary mt-1 h-4 w-4"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span className="text-foreground text-sm font-semibold">{dict.scheduleLater}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                {dict.scheduledDate} & {dict.scheduledTime}
              </p>
            </div>
          </label>
        </div>

        {/* Date and Time Pickers when Scheduled is chosen */}
        {!isAsap && (
          <div
            data-testid="scheduled-timing-inputs"
            className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <label htmlFor={dateId} className="text-foreground text-xs font-medium">
                {dict.scheduledDate} <span className="text-destructive">*</span>
              </label>
              <Input
                id={dateId}
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                data-testid="checkout-date-input"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={timeId} className="text-foreground text-xs font-medium">
                {dict.scheduledTime}
              </label>
              <Input
                id={timeId}
                type="time"
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                data-testid="checkout-time-input"
              />
            </div>
          </div>
        )}
      </section>

      {/* 4. Payment Preference */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <h2 className="text-foreground text-base font-semibold">{dict.paymentMethod}</h2>

        <div className="space-y-2">
          {/* Pay on Handover */}
          {cashAllowed && (
            <label
              data-testid="payment-on-handover"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                paymentPreference === "on_handover"
                  ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <input
                type="radio"
                name="paymentPreference"
                checked={paymentPreference === "on_handover"}
                onChange={() => setPaymentPreference("on_handover")}
                className="text-primary mt-1 h-4 w-4"
              />
              <div className="space-y-0.5">
                <span className="text-foreground text-sm font-semibold">{dict.payOnHandover}</span>
                <p className="text-muted-foreground text-xs">{dict.payOnHandoverSubtext}</p>
              </div>
            </label>
          )}

          {/* Revolut */}
          {revolutAllowed && (
            <label
              data-testid="payment-revolut"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                paymentPreference === "revolut"
                  ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <input
                type="radio"
                name="paymentPreference"
                checked={paymentPreference === "revolut"}
                onChange={() => setPaymentPreference("revolut")}
                className="text-primary mt-1 h-4 w-4"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-semibold">{dict.revolutPay}</span>
                  {settings?.revolutRevtag && (
                    <span className="border-border bg-muted rounded border px-1.5 py-0.5 font-mono text-[11px]">
                      @{settings.revolutRevtag}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  Fast mobile transfer with instant confirmation
                </p>
              </div>
            </label>
          )}

          {/* Wero */}
          {weroAllowed && (
            <label
              data-testid="payment-wero"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                paymentPreference === "wero"
                  ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <input
                type="radio"
                name="paymentPreference"
                checked={paymentPreference === "wero"}
                onChange={() => setPaymentPreference("wero")}
                className="text-primary mt-1 h-4 w-4"
              />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-semibold">{dict.weroPay}</span>
                  <span className="border-border bg-muted rounded border px-1.5 py-0.5 text-[11px] font-medium">
                    EU QR
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">Direct SEPA instant payment</p>
              </div>
            </label>
          )}
        </div>
      </section>

      {/* 5. Notes */}
      <section className="border-border bg-card space-y-2 rounded-xl border p-4 shadow-2xs sm:p-5">
        <label htmlFor={notesId} className="text-foreground text-base font-semibold">
          {dict.orderNotes}
        </label>
        <Textarea
          id={notesId}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={dict.notesPlaceholder}
          className="min-h-20"
          data-testid="checkout-notes-input"
        />
      </section>

      {/* 6. Order Summary Card */}
      <section className="border-border bg-card space-y-2.5 rounded-xl border p-4 shadow-2xs sm:p-5">
        <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {dict.orderSummary} ({items.length} {items.length === 1 ? dict.item : dict.items})
        </h2>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{dict.subtotal}</span>
          <span className="text-foreground font-medium tabular-nums">
            {formatMoney(totalAmountInCents, locale)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {serviceType === "delivery" ? dict.deliveryFee : dict.servicePickup}
          </span>
          <span className="text-foreground font-medium tabular-nums">
            {deliveryFee > 0 ? formatMoney(deliveryFee, locale) : dict.serviceFree}
          </span>
        </div>
        <div className="border-border/60 my-2 flex justify-between border-t pt-2.5 text-base font-bold">
          <span className="text-foreground">{dict.orderTotal}</span>
          <span className="text-foreground tabular-nums">{formatMoney(finalTotal, locale)}</span>
        </div>
      </section>

      {/* Error Feedback Message if any */}
      {errorFeedback && (
        <div
          data-testid="checkout-error-feedback"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl border p-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorFeedback}</span>
        </div>
      )}

      {/* Sticky Bottom Actions Bar */}
      <div className="bg-card/95 border-border pb-safe fixed inset-x-0 bottom-0 z-40 border-t p-4 backdrop-blur-md">
        <div className="mx-auto max-w-4xl space-y-2">
          <Button
            type="submit"
            disabled={!canSubmit}
            loading={isSubmitting}
            className="h-12 w-full rounded-xl text-base font-semibold shadow-xs"
            data-testid="place-order-button"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            <span>
              {isSubmitting
                ? dict.placingOrder
                : `${dict.placeOrder} • ${formatMoney(finalTotal, locale)}`}
            </span>
          </Button>

          <p className="text-muted-foreground text-center text-[11px]">{dict.orderPolicyNotice}</p>
        </div>
      </div>
    </form>
  );
}
