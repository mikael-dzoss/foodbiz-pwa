"use client";

import { useState, useId, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Pencil,
  CheckCircle2,
  Store,
  Truck,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  Wallet,
  QrCode,
  Banknote,
  BadgeCheck,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { StorefrontBusiness } from "@/domain/storefront-business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import {
  checkoutFormSchema,
  type CheckoutFormData,
  type PlaceOrderReason,
  type PlaceOrderSuccessData,
  GUEST_CONTACT_STORAGE_KEY,
  guestContactStorageSchema,
  type GuestContactStorage,
} from "@/domain/checkout";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/domain/guest";
import { ActionBar } from "@/components/ui/action-bar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatLeadTime, getLeadTime } from "@/domain/lead-time";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { useZonedToday } from "@/components/time/business-timezone";
import { useCart, resolveServiceMode } from "../context/cart-context";
import type { ActionCode, ActionFailure } from "@/lib/actions/types";
import { placeOrderAction } from "../storefront-actions";

/** Dictionary key for a place-order failure: its domain `reason` first, then its action code. */
const PLACE_ORDER_ERROR_KEYS = {
  ANTI_ABUSE_REJECTION: "orderErrorAntiAbuse",
  STORE_CLOSED: "orderErrorStoreClosed",
  SERVICE_TYPE_DISABLED: "orderErrorServiceDisabled",
  MINIMUM_ORDER_UNMET: "orderErrorMinimum",
  STOCK_ERROR: "orderErrorStock",
  VALIDATION: "orderErrorValidation",
  RATE_LIMITED: "orderErrorAntiAbuse",
  FORBIDDEN: "orderErrorAntiAbuse",
} as const satisfies Partial<Record<PlaceOrderReason | ActionCode, keyof StorefrontDictionary>>;

function placeOrderErrorKey(failure: ActionFailure): keyof StorefrontDictionary {
  const keys: Partial<Record<string, keyof StorefrontDictionary>> = PLACE_ORDER_ERROR_KEYS;
  return (
    (failure.reason ? keys[failure.reason] : undefined) ??
    keys[failure.code] ??
    "orderErrorInternal"
  );
}

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
  business: StorefrontBusiness;
  settings: BusinessSettings | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  onSubmitOrder?: (data: CheckoutFormData) => Promise<void> | void;
  onOrderSuccess?: () => void;
  redirectDelayMs?: number;
}

export function CheckoutForm({
  business,
  settings,
  locale,
  dict,
  onSubmitOrder,
  onOrderSuccess,
  redirectDelayMs,
}: CheckoutFormProps) {
  const router = useRouter();
  const {
    items,
    totalAmountInCents,
    notes: cartNotes,
    setNotes: setCartNotes,
    serviceMode,
    setServiceMode,
    clearCart,
  } = useCart();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [honeypot, setHoneypot] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<PlaceOrderSuccessData | null>(null);

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
  const leadTimeText = formatLeadTime(getLeadTime(settings), locale);
  // Earliest schedulable day: today in the business zone (null until hydrated)
  const today = useZonedToday(settings?.timezone ?? DEFAULT_TIMEZONE);
  const pickupAllowed = settings?.serviceTypes.pickup ?? true;
  const deliveryAllowed = settings?.serviceTypes.delivery ?? true;
  const preselectedService = resolveServiceMode(serviceMode, {
    pickup: pickupAllowed,
    delivery: deliveryAllowed,
  });
  const [customServiceType, setCustomServiceType] = useState<"pickup" | "delivery" | null>(null);
  const serviceType = customServiceType ?? preselectedService;
  const handleSelectServiceType = (mode: "pickup" | "delivery") => {
    setCustomServiceType(mode);
    setServiceMode(mode);
  };
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
  const [notes, setNotes] = useState(cartNotes);
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
        onOrderSuccess?.();
        setSubmittedSuccess(true);
      } else {
        const orderResult = await placeOrderAction({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          name: validationResult.data.name,
          phone: validationResult.data.phone,
          serviceType: validationResult.data.serviceType,
          deliveryAddress: validationResult.data.deliveryAddress,
          isAsap: validationResult.data.isAsap,
          requestedDate: validationResult.data.requestedDate,
          requestedTime: validationResult.data.requestedTime,
          paymentPreference: validationResult.data.paymentPreference,
          notes: validationResult.data.notes,
          idempotencyKey,
          honeypot,
        });

        if (!orderResult.ok) {
          setErrorFeedback(dict[placeOrderErrorKey(orderResult)]);
          setIsSubmitting(false);
          return;
        }

        // Display brief confirmation screen first, keeping order state visible
        onOrderSuccess?.();
        setConfirmedOrder(orderResult.data);
        setSubmittedSuccess(true);
        setIsSubmitting(false);

        // Keep the receipt on a reloadable token route; tracking is an explicit next step.
        const delay = redirectDelayMs ?? 1000;
        const trackingToken = orderResult.data.trackingToken;

        setTimeout(() => {
          clearCart();
          if (trackingToken) {
            router.push(`/${locale}/order/${encodeURIComponent(trackingToken)}/confirmed`);
          }
        }, delay);

        return;
      }
    } catch {
      setErrorFeedback(dict.orderErrorInternal);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirmation view displayed upon order submission announcing redirection
  if (submittedSuccess || confirmedOrder) {
    return (
      <div
        data-testid="checkout-success-view"
        className="border-border bg-card flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border p-8 text-center shadow-xs"
      >
        <div className="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-title-sm text-foreground">{dict.orderPlacedTitle}</h2>
        {confirmedOrder?.orderNumber && (
          <p className="text-primary mt-1 text-sm font-semibold">#{confirmedOrder.orderNumber}</p>
        )}
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">
          {confirmedOrder?.trackingToken ? dict.redirectingToTracking : dict.securityNotice}
        </p>

        {confirmedOrder?.trackingToken ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="text-primary h-4 w-4 animate-spin" />
              <span>{dict.redirectingToTracking}</span>
            </div>
            <Button asChild variant="outline" size="sm" className="mt-2 rounded-xl text-xs">
              <Link
                href={`/${locale}/order/${encodeURIComponent(confirmedOrder.trackingToken)}/confirmed`}
                onClick={() => clearCart()}
              >
                {dict.viewConfirmation} &rarr;
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <Button asChild size="lg" className="rounded-xl px-6">
              <Link href={`/${locale}`}>{dict.returnToCatalog}</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="checkout-form" noValidate>
      {/* Honeypot anti-spam trap (invisible to real users and screen readers) */}
      <div
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      >
        <label htmlFor="checkout-honeypot">Leave this field blank</label>
        <input
          id="checkout-honeypot"
          type="text"
          name="hp_field"
          autoComplete="off"
          tabIndex={-1}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          data-testid="checkout-honeypot-input"
        />
      </div>

      {/* 1. Customer Contact (Guest) */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-title-sm text-foreground flex items-center gap-1.5">
            <span className="text-primary font-bold">1.</span>
            {dict.customerContact}
          </h2>
          <span className="bg-primary/10 text-primary text-caption rounded px-2 py-0.5 font-medium">
            {dict.guestModeBadge}
          </span>
        </div>

        {/* Full Name field with Lock / Unlock affordance */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor={nameId} className="text-foreground text-xs font-medium">
              {dict.fullName} <span className="text-destructive">*</span>
            </label>
            {isNameLocked && (
              <Button
                variant="unstyled"
                size="none"
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
              </Button>
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
              className="bg-primary/10 text-primary border-primary/20 flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{dict.savedNameNotice}</span>
            </div>
          )}
        </div>

        {/* Mobile Phone field with E.164 validation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor={phoneId} className="text-foreground text-xs font-medium">
              {dict.phone} <span className="text-destructive">*</span>
            </label>
          </div>
          <div className="relative flex items-center">
            <span className="text-muted-foreground border-border absolute left-3 border-r pr-2 text-xs font-semibold tabular-nums select-none">
              FR +33
            </span>
            <Input
              id={phoneId}
              type="tel"
              value={phone}
              onChange={(e) => setCustomPhone(e.target.value)}
              placeholder={dict.phonePlaceholder}
              data-testid="checkout-phone-input"
              error={phone.length > 0 && !isPhoneValid}
              className="pl-20 tabular-nums"
              required
            />
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>{dict.phoneHelper}</span>
          </p>
        </div>
      </section>

      {/* 2. Fulfillment Mode */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <h2 className="text-title-sm text-foreground flex items-center gap-1.5">
          <span className="text-primary font-bold">2.</span>
          {dict.fulfillmentMode}
        </h2>

        {/* Segmented Mode Pills */}
        <SegmentedControl
          aria-label={dict.fulfillmentMode}
          value={serviceType}
          onValueChange={handleSelectServiceType}
          className="grid grid-cols-2 gap-1.5"
          optionClassName="min-h-9 py-2.5 text-xs font-semibold transition-all"
          selectedClassName="border-primary bg-primary/10 text-primary border shadow-xs"
          idleClassName="text-muted-foreground hover:text-foreground font-medium"
          options={[
            ...(pickupAllowed
              ? [
                  {
                    value: "pickup" as const,
                    "data-testid": "service-pickup-button",
                    label: (
                      <>
                        <Store className="h-4 w-4" />
                        <span>{dict.pickupFree}</span>
                      </>
                    ),
                  },
                ]
              : []),
            ...(deliveryAllowed
              ? [
                  {
                    value: "delivery" as const,
                    "data-testid": "service-delivery-button",
                    label: (
                      <>
                        <Truck className="h-4 w-4" />
                        <span>
                          {dict.deliveryPaid} (
                          {settings?.deliveryFee
                            ? formatMoney(settings.deliveryFee, locale)
                            : dict.serviceFree}
                          )
                        </span>
                      </>
                    ),
                  },
                ]
              : []),
          ]}
        />

        {/* Conditional Address or Pickup Location */}
        {serviceType === "pickup" ? (
          <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3 text-xs">
            <div className="border-border bg-card text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between">
                <p className="text-foreground truncate font-semibold">{business.name}</p>
                <span className="bg-muted text-muted-foreground text-micro rounded px-1.5 py-0.5 font-bold tracking-wider uppercase">
                  {dict.inStore}
                </span>
              </div>
              <p className="text-muted-foreground">{business.address}</p>
              <p className="text-muted-foreground text-caption flex items-center gap-1.5">
                <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
                <span>{dict.pickupExpressNotice}</span>
              </p>
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
        <h2 className="text-title-sm text-foreground flex items-center gap-1.5">
          <span className="text-primary font-bold">3.</span>
          {dict.orderTiming}
        </h2>

        <div className="space-y-2.5">
          {/* ASAP Option */}
          <label
            data-testid="timing-asap-option"
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
              isAsap
                ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                : "border-border bg-card text-muted-foreground hover:border-border/80"
            }`}
          >
            <div className="pt-0.5">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  isAsap ? "border-primary bg-card" : "border-muted-foreground/40"
                }`}
              >
                {isAsap && <span className="bg-primary h-2 w-2 rounded-full" />}
              </span>
            </div>
            <input
              type="radio"
              name="orderTiming"
              checked={isAsap}
              onChange={() => setIsAsap(true)}
              className="sr-only"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-foreground text-xs font-semibold">
                  {dict.asap.replace("{leadTime}", leadTimeText)}
                </span>
                <span className="bg-primary/10 text-primary text-micro rounded px-1.5 py-0.5 font-bold">
                  {dict.recommended}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">{dict.asapEstimatedReady}</p>
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
            <div className="pt-0.5">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  !isAsap ? "border-primary bg-card" : "border-muted-foreground/40"
                }`}
              >
                {!isAsap && <span className="bg-primary h-2 w-2 rounded-full" />}
              </span>
            </div>
            <input
              type="radio"
              name="orderTiming"
              checked={!isAsap}
              onChange={() => setIsAsap(false)}
              className="sr-only"
            />
            <div className="min-w-0 flex-1">
              <span className="text-foreground text-xs font-semibold">{dict.scheduleLater}</span>
              <p className="text-muted-foreground mt-0.5 text-xs">{dict.scheduleLaterSubtext}</p>

              {!isAsap && (
                <div
                  data-testid="scheduled-timing-inputs"
                  className="grid grid-cols-1 gap-2.5 pt-2.5 sm:grid-cols-2"
                >
                  <div className="space-y-1">
                    <label htmlFor={dateId} className="text-foreground text-caption font-medium">
                      {dict.scheduledDate} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id={dateId}
                      type="date"
                      min={today ?? undefined}
                      value={requestedDate}
                      onChange={(e) => setRequestedDate(e.target.value)}
                      data-testid="checkout-date-input"
                      className="h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={timeId} className="text-foreground text-caption font-medium">
                      {dict.scheduledTime}
                    </label>
                    <Input
                      id={timeId}
                      type="time"
                      value={requestedTime}
                      onChange={(e) => setRequestedTime(e.target.value)}
                      data-testid="checkout-time-input"
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>
      </section>

      {/* 4. Payment Preference */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-title-sm text-foreground flex items-center gap-1.5">
            <span className="text-primary font-bold">4.</span>
            {dict.paymentMethod}
          </h2>
          <span className="text-muted-foreground text-xs">{dict.secured}</span>
        </div>

        <div className="space-y-2">
          {/* Pay on Handover */}
          {cashAllowed && (
            <label
              data-testid="payment-on-handover"
              className={`flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-all ${
                paymentPreference === "on_handover"
                  ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      paymentPreference === "on_handover"
                        ? "border-primary bg-card"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {paymentPreference === "on_handover" && (
                      <span className="bg-primary h-2 w-2 rounded-full" />
                    )}
                  </span>
                </div>
                <input
                  type="radio"
                  name="paymentPreference"
                  checked={paymentPreference === "on_handover"}
                  onChange={() => setPaymentPreference("on_handover")}
                  className="sr-only"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground text-xs font-semibold">
                      {dict.payOnHandover}
                    </span>
                  </div>
                  <p className="text-primary text-xs font-medium">{dict.payOnHandoverSubtext}</p>
                  <div className="text-muted-foreground text-caption flex items-center gap-2 pt-1">
                    <span className="border-border bg-card inline-flex items-center gap-1 rounded border px-1.5 py-0.5">
                      <Banknote className="text-muted-foreground h-3 w-3" />
                      {dict.cashBadge}
                    </span>
                    <span className="border-border bg-card inline-flex items-center gap-1 rounded border px-1.5 py-0.5">
                      <CreditCard className="text-muted-foreground h-3 w-3" />
                      {dict.contactlessBadge}
                    </span>
                  </div>
                </div>
              </div>
              <BadgeCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
            </label>
          )}

          {/* Revolut */}
          {revolutAllowed && (
            <label
              data-testid="payment-revolut"
              className={`flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-all ${
                paymentPreference === "revolut"
                  ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      paymentPreference === "revolut"
                        ? "border-primary bg-card"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {paymentPreference === "revolut" && (
                      <span className="bg-primary h-2 w-2 rounded-full" />
                    )}
                  </span>
                </div>
                <input
                  type="radio"
                  name="paymentPreference"
                  checked={paymentPreference === "revolut"}
                  onChange={() => setPaymentPreference("revolut")}
                  className="sr-only"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-xs font-semibold">{dict.revolutPay}</span>
                    <span className="border-border bg-muted text-muted-foreground text-micro rounded border px-1.5 font-medium">
                      {dict.revolutSubtext}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-caption font-mono">
                    @{settings?.revolutRevtag || "petiteboulangerie"}
                  </p>
                </div>
              </div>
              <Wallet className="text-muted-foreground h-4 w-4 opacity-60" />
            </label>
          )}

          {/* Wero */}
          {weroAllowed && (
            <label
              data-testid="payment-wero"
              className={`flex cursor-pointer items-start justify-between rounded-xl border p-3.5 transition-all ${
                paymentPreference === "wero"
                  ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                  : "border-border bg-card text-muted-foreground hover:border-border/80"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      paymentPreference === "wero"
                        ? "border-primary bg-card"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {paymentPreference === "wero" && (
                      <span className="bg-primary h-2 w-2 rounded-full" />
                    )}
                  </span>
                </div>
                <input
                  type="radio"
                  name="paymentPreference"
                  checked={paymentPreference === "wero"}
                  onChange={() => setPaymentPreference("wero")}
                  className="sr-only"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-xs font-semibold">{dict.weroPay}</span>
                    <span className="border-border bg-muted text-muted-foreground text-micro rounded border px-1.5 font-medium">
                      {dict.weroSubtext}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-caption">{dict.weroDescription}</p>
                </div>
              </div>
              <QrCode className="text-muted-foreground h-4 w-4 opacity-60" />
            </label>
          )}
        </div>
      </section>

      {/* 5. Notes */}
      <section className="border-border bg-card space-y-2 rounded-xl border p-4 shadow-2xs sm:p-5">
        <label
          htmlFor={notesId}
          className="text-foreground flex items-center gap-1.5 text-sm font-semibold"
        >
          <span className="text-primary font-bold">5.</span>
          {dict.orderNotes}
        </label>
        <Textarea
          id={notesId}
          value={notes}
          onChange={(e) => {
            const val = e.target.value;
            setNotes(val);
            setCartNotes(val);
          }}
          placeholder={dict.notesPlaceholder}
          className="min-h-20"
          data-testid="checkout-notes-input"
        />
      </section>

      {/* 6. Order Summary Card */}
      <section className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-2xs sm:p-5">
        <div className="border-border flex items-center justify-between border-b pb-2">
          <h2 className="text-label-sm text-muted-foreground tracking-wider uppercase">
            {dict.orderSummary}
          </h2>
          <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">
            {items.reduce((acc, i) => acc + i.quantity, 0)}{" "}
            {items.length === 1 ? dict.item : dict.items}
          </span>
        </div>

        {/* Itemized line items preview */}
        <div className="space-y-1.5 text-xs">
          {items.map((item) => (
            <div key={item.productId} className="text-foreground flex justify-between">
              <span className="truncate pr-2">
                {item.quantity}× {item.name}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatMoney(item.price * item.quantity, locale)}
              </span>
            </div>
          ))}
        </div>

        <div className="border-border/60 space-y-1.5 border-t pt-2 text-xs">
          <div className="text-muted-foreground flex justify-between">
            <span>{dict.subtotal}</span>
            <span className="text-foreground font-medium tabular-nums">
              {formatMoney(totalAmountInCents, locale)}
            </span>
          </div>
          <div className="text-muted-foreground flex justify-between">
            <span>{serviceType === "delivery" ? dict.deliveryPaid : dict.pickupFree}</span>
            <span className="text-primary font-medium tabular-nums">
              {deliveryFee > 0 ? formatMoney(deliveryFee, locale) : `€0.00 (${dict.serviceFree})`}
            </span>
          </div>
        </div>

        <div className="border-border/60 flex items-center justify-between border-t pt-2.5">
          <span className="text-foreground text-sm font-bold">{dict.orderTotal}</span>
          <span className="text-primary text-lg font-bold tabular-nums">
            {formatMoney(finalTotal, locale)}
          </span>
        </div>
      </section>

      {/* Error Feedback Message if any */}
      {errorFeedback && (
        <div
          data-testid="checkout-error-feedback"
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-xl border p-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorFeedback}</span>
        </div>
      )}

      {/* In-flow sticky actions bar: settles above the footer at the end of the content (#237) */}
      <ActionBar
        placement="floating"
        contentClassName="space-y-2"
        data-testid="checkout-action-bar"
      >
        <Button
          type="submit"
          disabled={!canSubmit}
          loading={isSubmitting}
          className="h-12 w-full rounded-xl text-base font-semibold shadow-xs"
          data-testid="place-order-button"
        >
          <span>
            {isSubmitting
              ? dict.placingOrder
              : `${dict.placeOrder} • ${formatMoney(finalTotal, locale)}`}
          </span>
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>

        <p className="text-muted-foreground text-caption text-center">
          🔒 {dict.pickupPolicyNotice}
        </p>
      </ActionBar>
    </form>
  );
}
