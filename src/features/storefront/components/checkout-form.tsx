"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Pencil,
  CheckCircle2,
  Clock,
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
import { interpolate, type StorefrontDictionary, type SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import {
  checkoutFieldIssues,
  checkoutFormSchema,
  mapCheckoutIssueToDictKey,
  type CheckoutFieldName,
  type CheckoutFormData,
  type PlaceOrderReason,
  type PlaceOrderSuccessData,
  GUEST_CONTACT_STORAGE_KEY,
  guestContactStorageSchema,
  type GuestContactStorage,
} from "@/domain/checkout";
import { normalizePhoneNumber } from "@/domain/guest";
import { Alert } from "@/components/ui";
import { ActionBar } from "@/components/ui/action-bar";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatLeadTime, getLeadTime } from "@/domain/lead-time";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { NativeSelect } from "@/components/ui/native-select";
import { getZonedDay } from "@/domain/timezone";
import { isOpenAt, type OpeningSchedule } from "@/domain/opening-hours";
import { pickupScheduleFor, type StorefrontPickupLocation } from "@/domain/pickup-location";
import { logEvent } from "@/lib/log";
import { useCart, resolveServiceMode } from "../context/cart-context";
import { storefrontPricing } from "../storefront-pricing";
import { usePickupLocation } from "../use-pickup-location";
import type { ActionCode, ActionFailure } from "@/lib/actions/types";
import { placeOrderAction } from "../storefront-actions";
import {
  buildSlotOptions,
  closedNextOpeningLabelForSchedule,
  formatSlotDate,
  scheduleFromSettings,
  slotIssue,
} from "../checkout-slots";
import { PickupLocationPicker } from "./pickup-location-picker";

const EMPTY_PICKUP_LOCATIONS: readonly StorefrontPickupLocation[] = [];

/** How often the form re-evaluates the slot lists against the running clock (stale picks, #374). */
const SLOT_CLOCK_TICK_MS = 30_000;

/** Dictionary key for a place-order failure: its domain `reason` first, then its action code. */
const PLACE_ORDER_ERROR_KEYS = {
  ANTI_ABUSE_REJECTION: "orderErrorAntiAbuse",
  STORE_CLOSED: "orderErrorStoreClosed",
  SERVICE_TYPE_DISABLED: "orderErrorServiceDisabled",
  MINIMUM_ORDER_UNMET: "orderErrorMinimum",
  STOCK_ERROR: "orderErrorStock",
  SLOT_CLOSED_NOW: "orderErrorSlotClosedNow",
  SLOT_CLOSED_DAY: "orderErrorSlotClosedDay",
  SLOT_DATE_OUT_OF_WINDOW: "orderErrorSlotDateOutOfWindow",
  SLOT_TIME_OUTSIDE_HOURS: "orderErrorSlotTimeOutsideHours",
  SLOT_TIME_IN_PAST: "orderErrorSlotTimeInPast",
  PICKUP_LOCATION_INVALID: "orderErrorPickupLocationInvalid",
  PICKUP_LOCATION_REQUIRED: "orderErrorPickupLocationRequired",
  PICKUP_NOT_AVAILABLE: "orderErrorPickupNotAvailable",
  VALIDATION: "orderErrorValidation",
  RATE_LIMITED: "orderErrorAntiAbuse",
  FORBIDDEN: "orderErrorAntiAbuse",
} as const satisfies Record<PlaceOrderReason, keyof StorefrontDictionary> &
  Partial<Record<ActionCode, keyof StorefrontDictionary>>;

function placeOrderErrorKey(failure: ActionFailure): keyof StorefrontDictionary {
  const keys: Partial<Record<string, keyof StorefrontDictionary>> = PLACE_ORDER_ERROR_KEYS;
  return (
    (failure.reason ? keys[failure.reason] : undefined) ??
    keys[failure.code] ??
    "orderErrorInternal"
  );
}

const PICKUP_SERVER_ERROR_REASONS = new Set<string>([
  "PICKUP_LOCATION_INVALID",
  "PICKUP_LOCATION_REQUIRED",
  "PICKUP_NOT_AVAILABLE",
]);

const FOCUSABLE_FIELD_ORDER = [
  "name",
  "phone",
  "deliveryAddress",
  "requestedDate",
  "requestedTime",
  "notes",
] as const;

type FocusableCheckoutField = (typeof FOCUSABLE_FIELD_ORDER)[number];
type CheckoutFocusTarget = FocusableCheckoutField | "pickupLocation";

function omitKey(
  record: Partial<Record<CheckoutFieldName, boolean>>,
  ...keys: ReadonlyArray<CheckoutFieldName>
): Partial<Record<CheckoutFieldName, boolean>> {
  if (!keys.some((key) => record[key])) return record;
  const omitted = new Set<string>(keys);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !omitted.has(key))) as Partial<
    Record<CheckoutFieldName, boolean>
  >;
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
  shopPickupEnabled?: boolean;
  pickupLocations?: readonly StorefrontPickupLocation[];
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  isOpen?: boolean;
  isAcceptingOrders?: boolean;
  /** Request time (ISO) the server evaluated; seeds the slot lists so SSR and hydration agree. */
  nowIso?: string;
  onSubmitOrder?: (data: CheckoutFormData) => Promise<void> | void;
  onOrderSuccess?: () => void;
  redirectDelayMs?: number;
}

export function CheckoutForm({
  business,
  settings,
  shopPickupEnabled,
  pickupLocations = EMPTY_PICKUP_LOCATIONS,
  locale,
  dict,
  isOpen,
  isAcceptingOrders,
  nowIso,
  onSubmitOrder,
  onOrderSuccess,
  redirectDelayMs,
}: CheckoutFormProps) {
  const router = useRouter();
  const {
    items,
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
  // Slot clock: seeded from the server request time, then advanced by the elapsed browser time
  const timeZone = settings?.timezone ?? DEFAULT_TIMEZONE;
  const [clock] = useState(() => {
    const base = nowIso ? new Date(nowIso) : new Date();
    return { baseMs: base.getTime(), mountedMs: Date.now() };
  });
  const [now, setNow] = useState(() => new Date(clock.baseMs));
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date(clock.baseMs + (Date.now() - clock.mountedMs)));
    }, SLOT_CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [clock]);
  const today = getZonedDay(now, timeZone);
  const businessSchedule = useMemo(() => scheduleFromSettings(settings), [settings]);
  const pickupAllowed = settings?.serviceTypes.pickup ?? true;
  const deliveryAllowed = settings?.serviceTypes.delivery ?? true;
  const preselectedService = resolveServiceMode(serviceMode, {
    pickup: pickupAllowed,
    delivery: deliveryAllowed,
  });
  const [customServiceType, setCustomServiceType] = useState<"pickup" | "delivery" | null>(null);
  const serviceType = customServiceType ?? preselectedService;
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Pickup Location State (#386)
  const resolvedShopPickupEnabled = shopPickupEnabled ?? settings?.shopPickupEnabled ?? true;
  const pickupState = usePickupLocation(resolvedShopPickupEnabled, pickupLocations);
  const selectedRelay = serviceType === "pickup" ? pickupState.selectedRelay : null;
  const effectiveSchedule = useMemo(
    () =>
      selectedRelay
        ? pickupScheduleFor(businessSchedule, selectedRelay.weeklyHours)
        : businessSchedule,
    [businessSchedule, selectedRelay],
  );

  // Timing State
  const resolvedAcceptingOrders = isAcceptingOrders ?? settings?.acceptingOrders ?? true;
  // Structured hours drive open/closed on the ticking slot clock; the prop only covers legacy shops.
  const structuredHours =
    effectiveSchedule.weekly !== null || effectiveSchedule.exceptions.length > 0;
  const resolvedIsOpen = structuredHours
    ? isOpenAt(effectiveSchedule, timeZone, now)
    : (isOpen ?? true);
  const closedButAccepting = resolvedAcceptingOrders && !resolvedIsOpen;
  const [selectedAsap, setSelectedAsap] = useState(!closedButAccepting);
  const isAsap = closedButAccepting ? false : selectedAsap;
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const slotOptions = useMemo(
    () => buildSlotOptions(effectiveSchedule, timeZone, now, requestedDate),
    [effectiveSchedule, timeZone, now, requestedDate],
  );
  const slotProblem = isAsap
    ? null
    : slotIssue(
        effectiveSchedule,
        timeZone,
        now,
        requestedDate,
        requestedTime,
        slotOptions.timeRequired,
      );
  const noSlotsAvailable = !isAsap && slotOptions.dates.length === 0;
  // A stale pick stays in its sorted position, disabled and flagged, so the error points at it.
  const withStalePick = (values: string[], pick: string): string[] =>
    pick && !values.includes(pick) ? [...values, pick].toSorted() : values;
  const dateOptions = withStalePick(slotOptions.dates, requestedDate);
  const timeOptions = withStalePick(slotOptions.times, requestedTime);
  const closedNextOpening = closedButAccepting
    ? closedNextOpeningLabelForSchedule(effectiveSchedule, timeZone, now, locale, dict)
    : null;
  // Compute pricing via shared storefront pricing helper (#386)
  const pricing = useMemo(
    () =>
      storefrontPricing({
        items,
        serviceType,
        deliveryFee: settings?.deliveryFee ?? 0,
        pickupFee: selectedRelay?.feeCents ?? 0,
      }),
    [items, serviceType, settings?.deliveryFee, selectedRelay?.feeCents],
  );
  const pricingUnavailable = !pricing.ok;
  const pricingErrorReason = pricing.ok ? null : pricing.reason;
  useEffect(() => {
    if (!pricingErrorReason) return;
    logEvent("error", "storefront_pricing_failed", {
      screen: "checkout",
      serviceType,
      reason: pricingErrorReason,
    });
  }, [pricingErrorReason, serviceType]);

  const pickupUnavailable = serviceType === "pickup" && pickupState.unavailable;
  const pickupChoiceRequired = serviceType === "pickup" && pickupState.requiresChoice;
  // Only states that make ordering impossible block the button; the not-accepting sentence is
  // already announced by the top alert, so it is not repeated here.
  const blockedReason = !resolvedAcceptingOrders
    ? null
    : pricingUnavailable
      ? dict.pricingUnavailableError
      : pickupUnavailable
        ? dict.orderErrorPickupNotAvailable
        : pickupChoiceRequired
          ? dict.orderErrorPickupLocationRequired
          : noSlotsAvailable
            ? dict.checkoutNoSlots
            : null;
  const orderingBlocked =
    !resolvedAcceptingOrders ||
    pricingUnavailable ||
    pickupUnavailable ||
    pickupChoiceRequired ||
    noSlotsAvailable;

  // Payment State
  const revolutAllowed = settings?.paymentMethods.revolut ?? true;
  const weroAllowed = settings?.paymentMethods.wero ?? true;
  const cashAllowed = settings?.paymentMethods.cash ?? true;
  const cardAllowed = settings?.paymentMethods.card ?? false;
  const handoverAllowed = cashAllowed || cardAllowed;

  const handoverTitle =
    cashAllowed && cardAllowed
      ? dict.payOnHandover
      : cardAllowed
        ? dict.payOnHandoverCard
        : dict.payOnHandoverCash;
  const handoverSubtext =
    cashAllowed && cardAllowed
      ? dict.payOnHandoverSubtext
      : cardAllowed
        ? dict.payOnHandoverCardSubtext
        : dict.payOnHandoverCashSubtext;

  const defaultPaymentPref = handoverAllowed ? "on_handover" : revolutAllowed ? "revolut" : "wero";
  const [paymentPreference, setPaymentPreference] = useState<"on_handover" | "revolut" | "wero">(
    defaultPaymentPref,
  );

  // Notes & UI State
  const [notes, setNotes] = useState(cartNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [pickupServerError, setPickupServerError] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<CheckoutFieldName, boolean>>>(
    {},
  );
  const [hasInvalidSubmit, setHasInvalidSubmit] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    field: CheckoutFocusTarget;
    seq: number;
  } | null>(null);

  // Refs for focusing the first invalid control in DOM order on failed submit
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLSelectElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const timeSelectRef = useRef<HTMLSelectElement>(null);
  const notesInputRef = useRef<HTMLTextAreaElement>(null);
  const pickupPickerRef = useRef<HTMLElement | null>(null);
  const setPickupPickerNode = useCallback((node: HTMLElement | null) => {
    pickupPickerRef.current = node;
  }, []);

  const markTouched = (field: CheckoutFieldName) => {
    setTouchedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const syncSlotForSchedule = (nextSchedule: OpeningSchedule) => {
    if (!requestedDate) return;
    const nextSlotOptions = buildSlotOptions(nextSchedule, timeZone, now, requestedDate);
    if (!nextSlotOptions.dates.includes(requestedDate)) {
      setRequestedDate("");
      setRequestedTime("");
      setTouchedFields((prev) => omitKey(prev, "requestedDate", "requestedTime"));
    } else if (
      requestedTime &&
      nextSlotOptions.structured &&
      !nextSlotOptions.times.includes(requestedTime)
    ) {
      setRequestedTime("");
      setTouchedFields((prev) => omitKey(prev, "requestedTime"));
    }
  };

  const handleSelectServiceType = (mode: "pickup" | "delivery") => {
    setCustomServiceType(mode);
    setServiceMode(mode);
    setPickupServerError(null);
    setTouchedFields((prev) => omitKey(prev, "deliveryAddress"));
    const nextSchedule =
      mode === "pickup" && pickupState.selectedRelay
        ? pickupScheduleFor(businessSchedule, pickupState.selectedRelay.weeklyHours)
        : businessSchedule;
    syncSlotForSchedule(nextSchedule);
  };

  const handleSelectPickupLocation = (choice: string) => {
    pickupState.selectPickupLocation(choice);
    setPickupServerError(null);
    setErrorFeedback(null);
    const nextRelay = pickupLocations.find((location) => location.id === choice) ?? null;
    const nextSchedule = nextRelay
      ? pickupScheduleFor(businessSchedule, nextRelay.weeklyHours)
      : businessSchedule;
    syncSlotForSchedule(nextSchedule);
  };

  const handleSelectTiming = (asap: boolean) => {
    if (asap === isAsap) return;
    setSelectedAsap(asap);
    setTouchedFields((prev) => omitKey(prev, "requestedDate", "requestedTime"));
  };

  // Unique IDs for accessibility
  const nameId = useId();
  const phoneId = useId();
  const addressId = useId();
  const dateId = useId();
  const timeId = useId();
  const notesId = useId();
  const blockedReasonId = useId();

  // Form Validation Preview + Localized Per-Field Errors
  const { validationResult, fieldErrors } = useMemo(() => {
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
      requestedDate: isAsap ? undefined : requestedDate || undefined,
      requestedTime: isAsap ? undefined : requestedTime || undefined,
      paymentPreference,
      notes: notes || undefined,
    };
    const result = checkoutFormSchema.safeParse(rawForm);
    if (result.success) {
      return {
        validationResult: result,
        fieldErrors: {} as Partial<Record<CheckoutFieldName, string>>,
      };
    }

    const issuesByField = checkoutFieldIssues(rawForm, result);
    const errors: Partial<Record<CheckoutFieldName, string>> = {};
    for (const [field, issue] of Object.entries(issuesByField)) {
      if (issue) {
        errors[field as CheckoutFieldName] = dict[mapCheckoutIssueToDictKey(issue, name)];
      }
    }

    return { validationResult: result, fieldErrors: errors };
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
    dict,
  ]);

  // Slot rules join the zod errors so the submit/focus/summary flow treats them like any field.
  const slotField: CheckoutFieldName | null = slotProblem
    ? slotProblem.field === "date"
      ? "requestedDate"
      : "requestedTime"
    : null;
  const allFieldErrors: Partial<Record<CheckoutFieldName, string>> =
    slotProblem && slotField && !fieldErrors[slotField]
      ? { ...fieldErrors, [slotField]: dict[slotProblem.messageKey] }
      : fieldErrors;
  const formValid = validationResult.success && slotProblem === null;
  // "Choose a time" waits for interaction; stale or closed picks are explained immediately.
  const slotErrorVisible =
    slotProblem !== null &&
    (slotProblem.messageKey !== "checkoutTimeRequired" || Boolean(touchedFields.requestedTime));

  const visibleErrors: Partial<Record<CheckoutFieldName, string>> = {
    name: touchedFields.name ? fieldErrors.name : undefined,
    phone: touchedFields.phone ? fieldErrors.phone : undefined,
    serviceType: touchedFields.serviceType ? fieldErrors.serviceType : undefined,
    deliveryAddress: touchedFields.deliveryAddress ? fieldErrors.deliveryAddress : undefined,
    requestedDate:
      touchedFields.requestedDate || (slotErrorVisible && slotField === "requestedDate")
        ? allFieldErrors.requestedDate
        : undefined,
    requestedTime:
      touchedFields.requestedTime || (slotErrorVisible && slotField === "requestedTime")
        ? allFieldErrors.requestedTime
        : undefined,
    paymentPreference: touchedFields.paymentPreference ? fieldErrors.paymentPreference : undefined,
    notes: touchedFields.notes ? fieldErrors.notes : undefined,
  };

  useEffect(() => {
    if (!focusRequest) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (focusRequest.field === "pickupLocation") {
      const container = pickupPickerRef.current;
      if (!container) return;
      const firstRadio = container.querySelector<HTMLInputElement>('input[type="radio"]');
      const target = firstRadio ?? container;
      container.scrollIntoView?.({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
      target.focus();
      return;
    }
    const refMap: Record<FocusableCheckoutField, HTMLElement | null> = {
      name: nameInputRef.current,
      phone: phoneInputRef.current,
      deliveryAddress: addressInputRef.current,
      requestedDate: dateInputRef.current,
      requestedTime: timeInputRef.current ?? timeSelectRef.current,
      notes: notesInputRef.current,
    };
    const target = refMap[focusRequest.field];
    if (!target) return;
    target.scrollIntoView?.({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
    });
    target.focus();
  }, [focusRequest]);

  const [, formAction, isPending] = useActionState(async (): Promise<null> => {
    if (!validationResult.success || orderingBlocked) {
      return null;
    }

    setErrorFeedback(null);
    setPickupServerError(null);
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

      const pickupLocationId =
        validationResult.data.serviceType === "pickup" ? (selectedRelay?.id ?? null) : null;

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
          pickupLocationId,
          idempotencyKey,
          honeypot,
        });

        if (!orderResult.ok) {
          const message = dict[placeOrderErrorKey(orderResult)];
          if (
            validationResult.data.serviceType === "pickup" &&
            orderResult.reason &&
            PICKUP_SERVER_ERROR_REASONS.has(orderResult.reason)
          ) {
            setPickupServerError(message);
            if (
              orderResult.reason === "PICKUP_LOCATION_INVALID" ||
              orderResult.reason === "PICKUP_LOCATION_REQUIRED"
            ) {
              pickupState.selectPickupLocation(null);
            }
            setFocusRequest((prev) => ({
              field: "pickupLocation",
              seq: (prev?.seq ?? 0) + 1,
            }));
          } else {
            setErrorFeedback(message);
          }
          setIsSubmitting(false);
          return null;
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

        return null;
      }
    } catch {
      setErrorFeedback(dict.orderErrorInternal);
    } finally {
      setIsSubmitting(false);
    }
    return null;
  }, null);

  const submitting = isSubmitting || isPending;
  const canSubmit = items.length > 0 && !submitting && !orderingBlocked;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!canSubmit) {
      event.preventDefault();
      return;
    }

    if (!validationResult.success || slotProblem !== null) {
      event.preventDefault();
      setErrorFeedback(null);
      setPickupServerError(null);
      setHasInvalidSubmit(true);

      const activeFields: CheckoutFieldName[] = [
        "name",
        "phone",
        "serviceType",
        "paymentPreference",
        "notes",
      ];
      if (serviceType === "delivery") {
        activeFields.push("deliveryAddress");
      }
      if (!isAsap) {
        activeFields.push("requestedDate", "requestedTime");
      }

      setTouchedFields((prev) => {
        const next = { ...prev };
        for (const field of activeFields) {
          next[field] = true;
        }
        return next;
      });

      const firstInvalidField = FOCUSABLE_FIELD_ORDER.find((field) =>
        Boolean(allFieldErrors[field]),
      );
      if (firstInvalidField) {
        if (firstInvalidField === "name" && isNameLocked) {
          setIsUnlocked(true);
        }
        setFocusRequest((prev) => ({
          field: firstInvalidField,
          seq: (prev?.seq ?? 0) + 1,
        }));
      }
      return;
    }

    setHasInvalidSubmit(false);
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
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-6"
      data-testid="checkout-form"
      noValidate
    >
      {/* Single polite live region for invalid submit summary (avoids double announcements with focused aria-describedby) */}
      <p
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="checkout-validation-summary"
      >
        {/* Keyed per submit so a repeated invalid submit replaces the node and is re-announced */}
        {hasInvalidSubmit && !formValid ? (
          <span key={focusRequest?.seq ?? 0}>{dict.formValidationSummary}</span>
        ) : null}
      </p>
      {/* Honeypot anti-spam trap (invisible to real users and screen readers) */}
      <div
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      >
        <label htmlFor="checkout-honeypot">{dict.honeypotLabel}</label>
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

      {!resolvedAcceptingOrders && (
        <Alert tone="error" role="status" data-testid="checkout-not-accepting-notice">
          {dict.checkoutBlockedNotAccepting}
        </Alert>
      )}

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
          {isNameLocked && (
            <div className="flex justify-end">
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
            </div>
          )}

          <Field
            id={nameId}
            label={dict.fullName}
            required
            error={visibleErrors.name}
            announceError={false}
            data-testid="checkout-name-field"
          >
            {(control) => (
              <div className="relative">
                {isNameLocked && (
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4" />
                  </div>
                )}
                <Input
                  {...control}
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  disabled={isNameLocked}
                  onChange={(e) => setCustomName(e.target.value)}
                  onBlur={() => markTouched("name")}
                  placeholder={dict.fullNamePlaceholder}
                  className={isNameLocked ? "pl-9 font-medium" : ""}
                  data-testid="checkout-name-input"
                  required
                />
              </div>
            )}
          </Field>

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
        <Field
          id={phoneId}
          label={dict.phone}
          required
          error={visibleErrors.phone}
          announceError={false}
          data-testid="checkout-phone-field"
          hint={
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span>{dict.phoneHelper}</span>
            </span>
          }
        >
          {(control) => (
            <div className="relative flex items-center">
              <span className="text-muted-foreground border-border absolute left-3 border-r pr-2 text-xs font-semibold tabular-nums select-none">
                FR +33
              </span>
              <Input
                {...control}
                ref={phoneInputRef}
                type="tel"
                value={phone}
                onChange={(e) => setCustomPhone(e.target.value)}
                onBlur={() => markTouched("phone")}
                placeholder={dict.phonePlaceholder}
                data-testid="checkout-phone-input"
                className="pl-20 tabular-nums"
                required
              />
            </div>
          )}
        </Field>
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
                        <span>
                          {pickupState.hasPaidOption
                            ? pickupState.isSingleOption && pickupState.selectedRelay
                              ? interpolate(dict.pickupLocationWithFee, {
                                  amount: formatMoney(pickupState.selectedRelay.feeCents, locale),
                                })
                              : dict.pickupToggleLabel
                            : dict.pickupFree}
                        </span>
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

        {visibleErrors.serviceType && (
          <p
            data-testid="checkout-service-type-error"
            className="text-body-sm text-destructive flex items-start gap-1.5"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{visibleErrors.serviceType}</span>
          </p>
        )}

        {/* Conditional Address or Pickup Location */}
        {serviceType === "pickup" ? (
          <PickupLocationPicker
            shopPickupEnabled={resolvedShopPickupEnabled}
            pickupLocations={pickupLocations}
            businessName={business.name}
            businessAddress={business.address}
            businessSchedule={businessSchedule}
            openingHoursText={settings?.openingHours}
            selectedChoice={pickupState.selectedChoice}
            onSelect={handleSelectPickupLocation}
            locale={locale}
            dict={dict}
            showRequiredPrompt
            error={pickupServerError}
            pickerRef={setPickupPickerNode}
            data-testid="checkout-pickup-picker"
          />
        ) : (
          <Field
            id={addressId}
            label={dict.deliveryAddress}
            required
            error={visibleErrors.deliveryAddress}
            announceError={false}
            data-testid="delivery-address-container"
          >
            <Input
              ref={addressInputRef}
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              onBlur={() => markTouched("deliveryAddress")}
              placeholder={dict.deliveryAddressPlaceholder}
              data-testid="checkout-address-input"
              required
            />
          </Field>
        )}
      </section>

      {/* 3. Order Timing */}
      <section className="border-border bg-card space-y-4 rounded-xl border p-4 shadow-2xs sm:p-5">
        <h2 className="text-title-sm text-foreground flex items-center gap-1.5">
          <span className="text-primary font-bold">3.</span>
          {dict.orderTiming}
        </h2>

        {closedButAccepting && (
          <Alert
            tone="warning"
            icon={<Clock className="h-4 w-4" />}
            data-testid="checkout-closed-schedule-notice"
          >
            {selectedRelay
              ? closedNextOpening
                ? dict.pickupLocationClosedNextOpening.replace("{when}", closedNextOpening)
                : dict.pickupLocationClosedScheduleNotice
              : closedNextOpening
                ? dict.checkoutClosedNextOpening.replace("{when}", closedNextOpening)
                : dict.checkoutClosedScheduleNotice}
          </Alert>
        )}

        <div className="space-y-2.5">
          {/* ASAP Option */}
          {!closedButAccepting && (
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
                onChange={() => handleSelectTiming(true)}
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
          )}

          {/* Schedule Later Option */}
          <div
            data-testid="timing-scheduled-card"
            className={`relative rounded-xl border p-3.5 transition-all ${
              !isAsap
                ? "border-primary bg-primary/5 text-foreground ring-primary ring-1"
                : "border-border bg-card text-muted-foreground hover:border-border/80"
            }`}
          >
            <label
              data-testid="timing-scheduled-option"
              className="flex cursor-pointer items-start gap-3 after:absolute after:inset-0"
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
                onChange={() => handleSelectTiming(false)}
                className="sr-only"
              />
              <div className="min-w-0 flex-1">
                <span className="text-foreground text-xs font-semibold">{dict.scheduleLater}</span>
                <p className="text-muted-foreground mt-0.5 text-xs">{dict.scheduleLaterSubtext}</p>
              </div>
            </label>

            {!isAsap && (
              <div
                data-testid="scheduled-timing-inputs"
                className="relative z-10 grid grid-cols-1 gap-2.5 pt-2.5 sm:grid-cols-2 sm:pl-7"
              >
                <Field
                  id={dateId}
                  label={dict.scheduledDate}
                  required
                  error={visibleErrors.requestedDate}
                  announceError={false}
                  className="min-w-0"
                  data-testid="checkout-date-field"
                >
                  {(control) => (
                    <NativeSelect
                      {...control}
                      ref={dateInputRef}
                      value={requestedDate}
                      onChange={(e) => {
                        setRequestedDate(e.target.value);
                        setRequestedTime("");
                      }}
                      onBlur={() => markTouched("requestedDate")}
                      data-testid="checkout-date-input"
                      className="min-w-0"
                    >
                      <option value="">{dict.checkoutChooseDate}</option>
                      {dateOptions.map((date) => {
                        const label = formatSlotDate(date, today, locale, dict);
                        const stale = !slotOptions.dates.includes(date);
                        return (
                          <option key={date} value={date} disabled={stale}>
                            {stale ? dict.checkoutSlotUnavailable.replace("{value}", label) : label}
                          </option>
                        );
                      })}
                    </NativeSelect>
                  )}
                </Field>

                <Field
                  id={timeId}
                  label={slotOptions.timeRequired ? dict.scheduledTimeRequired : dict.scheduledTime}
                  required={slotOptions.timeRequired}
                  error={visibleErrors.requestedTime}
                  hint={
                    slotOptions.note
                      ? dict.checkoutDayNote.replace("{note}", slotOptions.note)
                      : undefined
                  }
                  announceError={false}
                  className="min-w-0"
                  data-testid="checkout-time-field"
                >
                  {(control) =>
                    slotOptions.structured ? (
                      <NativeSelect
                        {...control}
                        ref={timeSelectRef}
                        value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                        onBlur={() => markTouched("requestedTime")}
                        data-testid="checkout-time-input"
                        className="min-w-0"
                      >
                        <option value="">{dict.checkoutChooseTime}</option>
                        {timeOptions.map((time) => {
                          const stale = !slotOptions.times.includes(time);
                          return (
                            <option key={time} value={time} disabled={stale}>
                              {stale ? dict.checkoutSlotUnavailable.replace("{value}", time) : time}
                            </option>
                          );
                        })}
                      </NativeSelect>
                    ) : (
                      <Input
                        {...control}
                        ref={timeInputRef}
                        type="time"
                        value={requestedTime}
                        onChange={(e) => setRequestedTime(e.target.value)}
                        onBlur={() => markTouched("requestedTime")}
                        data-testid="checkout-time-input"
                        className="w-full min-w-0"
                      />
                    )
                  }
                </Field>
              </div>
            )}
          </div>
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
          {handoverAllowed && (
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
                    <span className="text-foreground text-xs font-semibold">{handoverTitle}</span>
                  </div>
                  <p className="text-primary text-xs font-medium">{handoverSubtext}</p>
                  <div className="text-muted-foreground text-caption flex items-center gap-2 pt-1">
                    {cashAllowed && (
                      <span
                        data-testid="payment-badge-cash"
                        className="border-border bg-card inline-flex items-center gap-1 rounded border px-1.5 py-0.5"
                      >
                        <Banknote className="text-muted-foreground h-3 w-3" />
                        {dict.cashBadge}
                      </span>
                    )}
                    {cardAllowed && (
                      <span
                        data-testid="payment-badge-card"
                        className="border-border bg-card inline-flex items-center gap-1 rounded border px-1.5 py-0.5"
                      >
                        <CreditCard className="text-muted-foreground h-3 w-3" />
                        {dict.contactlessBadge}
                      </span>
                    )}
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
                  {settings?.revolutRevtag ? (
                    <p
                      className="text-muted-foreground text-caption font-mono"
                      data-testid="checkout-revolut-tag"
                    >
                      @{settings.revolutRevtag.replace(/^@/, "")}
                    </p>
                  ) : null}
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
        {visibleErrors.paymentPreference && (
          <p
            data-testid="checkout-payment-preference-error"
            className="text-body-sm text-destructive flex items-start gap-1.5"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{visibleErrors.paymentPreference}</span>
          </p>
        )}
      </section>

      {/* 5. Notes */}
      <section className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-2xs sm:p-5">
        <h2 className="text-title-sm text-foreground flex items-center gap-1.5">
          <span className="text-primary font-bold">5.</span>
          {dict.orderNotes}
        </h2>
        <Field
          id={notesId}
          label={dict.addKitchenNote}
          error={visibleErrors.notes}
          announceError={false}
          data-testid="checkout-notes-field"
        >
          <Textarea
            ref={notesInputRef}
            value={notes}
            onChange={(e) => {
              const val = e.target.value;
              setNotes(val);
              setCartNotes(val);
            }}
            onBlur={() => markTouched("notes")}
            placeholder={dict.notesPlaceholder}
            className="min-h-20"
            data-testid="checkout-notes-input"
          />
        </Field>
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
              {pricing.ok && (
                <span className="shrink-0 font-medium tabular-nums">
                  {formatMoney(item.price * item.quantity, locale)}
                </span>
              )}
            </div>
          ))}
        </div>

        {pricing.ok ? (
          <>
            <div className="border-border/60 space-y-1.5 border-t pt-2 text-xs">
              <div className="text-muted-foreground flex justify-between">
                <span>{dict.subtotal}</span>
                <span className="text-foreground font-medium tabular-nums">
                  {formatMoney(pricing.subtotal, locale)}
                </span>
              </div>
              <div
                data-testid="checkout-fee-row"
                className="text-muted-foreground flex justify-between gap-2"
              >
                <span className="truncate">
                  {serviceType === "delivery"
                    ? dict.deliveryPaid
                    : selectedRelay
                      ? `${dict.pickupLocationFeeLabel} · ${selectedRelay.name}`
                      : dict.pickupLocationFeeLabel}
                </span>
                <span
                  data-testid="checkout-fee-value"
                  className="text-primary shrink-0 font-medium tabular-nums"
                >
                  {serviceType === "delivery"
                    ? pricing.deliveryFee > 0
                      ? formatMoney(pricing.deliveryFee, locale)
                      : dict.pickupLocationFeeFree
                    : pricing.pickupFee > 0
                      ? formatMoney(pricing.pickupFee, locale)
                      : pickupChoiceRequired && pickupState.hasPaidOption
                        ? dict.pickupLocationFeePending
                        : dict.pickupLocationFeeFree}
                </span>
              </div>
            </div>

            <div className="border-border/60 flex items-center justify-between border-t pt-2.5">
              <span className="text-foreground text-sm font-bold">{dict.orderTotal}</span>
              <span
                data-testid="checkout-order-total"
                className="text-primary text-lg font-bold tabular-nums"
              >
                {formatMoney(pricing.total, locale)}
              </span>
            </div>
          </>
        ) : (
          <Alert tone="error" data-testid="checkout-pricing-error">
            {dict.pricingUnavailableError}
          </Alert>
        )}
      </section>

      {/* Error Feedback Message if any */}
      {errorFeedback && (
        <Alert tone="error" data-testid="checkout-error-feedback">
          {errorFeedback}
        </Alert>
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
          loading={submitting}
          aria-describedby={blockedReason ? blockedReasonId : undefined}
          className="h-12 w-full rounded-xl text-base font-semibold shadow-xs"
          data-testid="place-order-button"
        >
          <span>
            {submitting
              ? dict.placingOrder
              : pricing.ok
                ? `${dict.placeOrder} • ${formatMoney(pricing.total, locale)}`
                : dict.placeOrder}
          </span>
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>

        {/* Always mounted so a reason appearing later is announced; keyed so a change re-announces */}
        <p
          id={blockedReasonId}
          aria-live="polite"
          aria-atomic="true"
          data-testid="checkout-blocked-reason-region"
          className="text-destructive text-caption text-center"
        >
          {blockedReason ? (
            <span
              key={blockedReason}
              data-testid="checkout-blocked-reason"
              className="flex items-start justify-center gap-1.5"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{blockedReason}</span>
            </span>
          ) : null}
        </p>

        <p className="text-muted-foreground text-caption text-center">
          🔒 {dict.pickupPolicyNotice}
        </p>
      </ActionBar>
    </form>
  );
}
