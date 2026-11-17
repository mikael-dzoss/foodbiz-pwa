"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  Clock,
  Truck,
  ShoppingBag,
  Store,
  AlertCircle,
  Loader2,
  MapPin,
  Layers,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import { formatLeadTime, leadTimeUnitSchema, type LeadTimeUnit } from "@/domain/lead-time";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonBadge } from "@/components/feedback";
import { Switch, useToast } from "@/components/ui";
import { updateOrderingSettingsAction } from "../actions";
import { actionErrorMessage } from "@/lib/actions/error-message";

export interface OrderingSettingsFormProps {
  settings: BusinessSettings;
  dict: SettingsDictionary;
  locale?: "en" | "fr";
}

export function OrderingSettingsForm({ settings, dict, locale = "en" }: OrderingSettingsFormProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  // 1. Store acceptance status
  const [acceptingOrders, setAcceptingOrders] = useState(settings.acceptingOrders ?? true);

  // 2. Service types
  const [pickup, setPickup] = useState(settings.serviceTypes?.pickup ?? true);
  const [delivery, setDelivery] = useState(settings.serviceTypes?.delivery ?? true);
  const [dineIn, setDineIn] = useState(settings.serviceTypes?.dineIn ?? true);

  // 3. Opening hours (optional)
  const [openingHours, setOpeningHours] = useState(settings.openingHours ?? "");

  // 4. Order timing & scheduling
  const [orderTimingAsap, setOrderTimingAsap] = useState(settings.orderTimingAsap ?? true);
  const [orderTimingScheduled, setOrderTimingScheduled] = useState(
    settings.orderTimingScheduled ?? true,
  );
  const [orderTimingTimeOptional, setOrderTimingTimeOptional] = useState(
    settings.orderTimingTimeOptional ?? true,
  );

  // 5. Delivery parameters (in euros string for input, converted to cents for action)
  const [deliveryFeeEuros, setDeliveryFeeEuros] = useState(
    ((settings.deliveryFee ?? 0) / 100).toFixed(2),
  );
  const [minOrderEuros, setMinOrderEuros] = useState(
    ((settings.minOrderAmount ?? 0) / 100).toFixed(2),
  );

  // 6. Preparation lead time (#225)
  const [leadTimeValue, setLeadTimeValue] = useState(String(settings.leadTimeValue ?? 1));
  const [leadTimeUnit, setLeadTimeUnit] = useState<LeadTimeUnit>(
    settings.leadTimeUnit ?? "business_days",
  );
  const parsedLeadTimeValue = Number.parseInt(leadTimeValue, 10);
  const leadTimePreview =
    Number.isInteger(parsedLeadTimeValue) && parsedLeadTimeValue >= 1
      ? formatLeadTime({ value: parsedLeadTimeValue, unit: leadTimeUnit }, locale)
      : null;

  // Errors
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleDiscard = () => {
    setAcceptingOrders(settings.acceptingOrders ?? true);
    setPickup(settings.serviceTypes?.pickup ?? true);
    setDelivery(settings.serviceTypes?.delivery ?? true);
    setDineIn(settings.serviceTypes?.dineIn ?? true);
    setOpeningHours(settings.openingHours ?? "");
    setOrderTimingAsap(settings.orderTimingAsap ?? true);
    setOrderTimingScheduled(settings.orderTimingScheduled ?? true);
    setOrderTimingTimeOptional(settings.orderTimingTimeOptional ?? true);
    setDeliveryFeeEuros(((settings.deliveryFee ?? 0) / 100).toFixed(2));
    setMinOrderEuros(((settings.minOrderAmount ?? 0) / 100).toFixed(2));
    setLeadTimeValue(String(settings.leadTimeValue ?? 1));
    setLeadTimeUnit(settings.leadTimeUnit ?? "business_days");
    setErrors({});
    showToast("Changes discarded");
  };

  const activeServiceCount = [pickup, delivery, dineIn].filter(Boolean).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client check: at least one service type must be enabled
    if (!pickup && !delivery && !dineIn) {
      setErrors({
        serviceTypes: ["At least one fulfillment mode must be enabled"],
      });
      showToast("At least one fulfillment mode must be enabled");
      return;
    }

    const deliveryFeeCents = Math.round((parseFloat(deliveryFeeEuros) || 0) * 100);
    const minOrderCents = Math.round((parseFloat(minOrderEuros) || 0) * 100);

    startTransition(async () => {
      const res = await updateOrderingSettingsAction({
        acceptingOrders,
        serviceTypes: {
          pickup,
          delivery,
          dineIn,
        },
        openingHours,
        orderTimingAsap,
        orderTimingScheduled,
        orderTimingTimeOptional,
        deliveryFee: deliveryFeeCents,
        minOrderAmount: minOrderCents,
        leadTimeValue: parsedLeadTimeValue,
        leadTimeUnit,
      });

      if (res.ok) {
        showToast(dict.ordering.saveSuccess);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        showToast(actionErrorMessage(res));
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md px-4 py-6 pb-32"
      data-testid="ordering-settings-form"
    >
      {/* Top Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/manage/settings"
          data-testid="back-to-settings"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>{dict.title}</span>
        </Link>
        <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          M-63
        </span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-display-sm text-foreground font-bold tracking-tight">
          {dict.ordering.title}
        </h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.ordering.description}</p>
      </div>

      {/* Section 1: Store Acceptance Status */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.ordering.statusSection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm font-semibold">
                  {dict.ordering.acceptingOrdersLabel}
                </span>
                <span
                  data-testid="store-status-badge"
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    acceptingOrders
                      ? "bg-primary-soft text-primary-soft-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {acceptingOrders ? "Live / Accepting" : "Paused"}
                </span>
              </div>
              <p className="text-body-sm text-muted-foreground mt-1">
                {dict.ordering.acceptingOrdersDesc}
              </p>
            </div>
            <Switch
              checked={acceptingOrders}
              onCheckedChange={setAcceptingOrders}
              data-testid="switch-accepting-orders"
              aria-label={dict.ordering.acceptingOrdersLabel}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Service Types */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-label-sm text-muted-foreground font-semibold tracking-wider uppercase">
            {dict.ordering.serviceTypesSection}
          </h2>
          <span className="text-muted-foreground text-xs font-medium">
            {activeServiceCount} of 3 active
          </span>
        </div>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          {/* Pickup */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.ordering.pickupLabel}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.ordering.pickupDesc}
                </span>
              </div>
            </div>
            <Switch
              checked={pickup}
              onCheckedChange={setPickup}
              data-testid="switch-service-pickup"
              aria-label={dict.ordering.pickupLabel}
            />
          </div>

          {/* Delivery */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.ordering.deliveryLabel}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.ordering.deliveryDesc}
                </span>
              </div>
            </div>
            <Switch
              checked={delivery}
              onCheckedChange={setDelivery}
              data-testid="switch-service-delivery"
              aria-label={dict.ordering.deliveryLabel}
            />
          </div>

          {/* Dine-in */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {dict.ordering.dineInLabel}
                </span>
                <span className="text-body-sm text-muted-foreground block truncate">
                  {dict.ordering.dineInDesc}
                </span>
              </div>
            </div>
            <Switch
              checked={dineIn}
              onCheckedChange={setDineIn}
              data-testid="switch-service-dinein"
              aria-label={dict.ordering.dineInLabel}
            />
          </div>
        </div>
        {errors.serviceTypes && (
          <p className="text-destructive mt-1.5 flex items-center gap-1 px-1 text-xs font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{errors.serviceTypes[0]}</span>
          </p>
        )}
      </div>

      {/* Section 3: Opening Hours (Optional) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.ordering.hoursSection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-muted-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor="opening-hours-input"
                className="text-foreground block text-sm font-semibold"
              >
                {dict.ordering.hoursLabel}
              </label>
              <p className="text-body-sm text-muted-foreground mt-0.5">
                {dict.ordering.hoursHelper}
              </p>
              <textarea
                id="opening-hours-input"
                data-testid="input-opening-hours"
                rows={2}
                value={openingHours}
                onChange={(e) => setOpeningHours(e.target.value)}
                placeholder="e.g. Mon-Sat: 08:00 - 19:30, Sun: Closed"
                className="border-input bg-background text-foreground focus-visible:ring-ring mt-3 w-full rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Leave empty for continuous dark kitchen or on-demand delivery operations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Order Timing */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.ordering.timingSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          {/* ASAP Orders */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="text-foreground block text-sm font-semibold">
                {dict.ordering.asapLabel}
              </span>
              <span className="text-body-sm text-muted-foreground block truncate">
                {dict.ordering.asapDesc}
              </span>
            </div>
            <Switch
              checked={orderTimingAsap}
              onCheckedChange={setOrderTimingAsap}
              data-testid="switch-timing-asap"
              aria-label={dict.ordering.asapLabel}
            />
          </div>

          {/* Scheduled Orders */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="text-foreground block text-sm font-semibold">
                {dict.ordering.scheduledLabel}
              </span>
              <span className="text-body-sm text-muted-foreground block truncate">
                {dict.ordering.scheduledDesc}
              </span>
            </div>
            <Switch
              checked={orderTimingScheduled}
              onCheckedChange={setOrderTimingScheduled}
              data-testid="switch-timing-scheduled"
              aria-label={dict.ordering.scheduledLabel}
            />
          </div>

          {/* Time Optional */}
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <span className="text-foreground block text-sm font-semibold">
                {dict.ordering.timeOptionalLabel}
              </span>
              <span className="text-body-sm text-muted-foreground block truncate">
                {dict.ordering.timeOptionalDesc}
              </span>
            </div>
            <Switch
              checked={orderTimingTimeOptional}
              onCheckedChange={setOrderTimingTimeOptional}
              data-testid="switch-timing-time-optional"
              aria-label={dict.ordering.timeOptionalLabel}
            />
          </div>
        </div>
      </div>

      {/* Section 5: Delivery Rules */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.ordering.deliverySection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-4 shadow-2xs">
          <div>
            <label
              htmlFor="delivery-fee-input"
              className="text-foreground block text-sm font-semibold"
            >
              {dict.ordering.deliveryFeeLabel}
            </label>
            <p className="text-body-sm text-muted-foreground mt-0.5">
              {dict.ordering.deliveryFeeHelper}
            </p>
            <div className="relative mt-2">
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium">
                €
              </span>
              <input
                id="delivery-fee-input"
                data-testid="input-delivery-fee"
                type="number"
                step="0.10"
                min="0"
                value={deliveryFeeEuros}
                onChange={(e) => setDeliveryFeeEuros(e.target.value)}
                className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-xl border py-2 pr-3 pl-8 font-mono text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>
            {errors.deliveryFee && (
              <p className="text-danger mt-1 text-xs">{errors.deliveryFee[0]}</p>
            )}
          </div>

          <div className="border-border border-t pt-3">
            <label
              htmlFor="min-order-input"
              className="text-foreground block text-sm font-semibold"
            >
              {dict.ordering.minOrderLabel}
            </label>
            <p className="text-body-sm text-muted-foreground mt-0.5">
              {dict.ordering.minOrderHelper}
            </p>
            <div className="relative mt-2">
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium">
                €
              </span>
              <input
                id="min-order-input"
                data-testid="input-min-order"
                type="number"
                step="0.50"
                min="0"
                value={minOrderEuros}
                onChange={(e) => setMinOrderEuros(e.target.value)}
                className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-xl border py-2 pr-3 pl-8 font-mono text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              />
            </div>
            {errors.minOrderAmount && (
              <p className="text-danger mt-1 text-xs">{errors.minOrderAmount[0]}</p>
            )}
          </div>
        </div>
      </div>

      {/* Section 5b: Preparation lead time (#225) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.ordering.leadTimeSection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-4 shadow-2xs">
          <fieldset>
            <legend className="text-foreground block text-sm font-semibold">
              {dict.ordering.leadTimeLabel}
            </legend>
            <p className="text-body-sm text-muted-foreground mt-0.5">
              {dict.ordering.leadTimeHelper}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                id="lead-time-value-input"
                data-testid="input-lead-time-value"
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                step="1"
                aria-label={dict.ordering.leadTimeLabel}
                aria-invalid={!!errors.leadTimeValue}
                value={leadTimeValue}
                onChange={(e) => setLeadTimeValue(e.target.value)}
                className="border-input bg-background text-foreground focus-visible:ring-ring min-h-11 w-24 rounded-xl border px-3 py-2 font-mono text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              />
              <select
                id="lead-time-unit-select"
                data-testid="select-lead-time-unit"
                aria-label={dict.ordering.leadTimeUnitLabel}
                value={leadTimeUnit}
                onChange={(e) => {
                  const parsed = leadTimeUnitSchema.safeParse(e.target.value);
                  if (parsed.success) setLeadTimeUnit(parsed.data);
                }}
                className="border-input bg-background text-foreground focus-visible:ring-ring min-h-11 flex-1 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="minutes">{dict.ordering.leadTimeUnitMinutes}</option>
                <option value="hours">{dict.ordering.leadTimeUnitHours}</option>
                <option value="business_days">{dict.ordering.leadTimeUnitBusinessDays}</option>
              </select>
            </div>
            {leadTimePreview && (
              <p
                data-testid="lead-time-preview"
                aria-live="polite"
                className="text-muted-foreground mt-2 text-xs"
              >
                {dict.ordering.leadTimePreview.replace("{leadTime}", leadTimePreview)}
              </p>
            )}
            {errors.leadTimeValue && (
              <p className="text-danger mt-1 text-xs">{errors.leadTimeValue[0]}</p>
            )}
          </fieldset>
        </div>
      </div>

      {/* Section 6: Upcoming Capabilities */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 font-semibold tracking-wider uppercase">
          {dict.ordering.soonSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          <div className="flex items-center justify-between p-4 opacity-75">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Delivery Zones & Postcode Limits
                </span>
                <span className="text-muted-foreground block text-xs">
                  Radius or postal code geo-fencing for dispatch
                </span>
              </div>
            </div>
            {/* TODO(ordering): wire live delivery zone bounds (#71) */}
            <SoonBadge />
          </div>

          <div className="flex items-center justify-between p-4 opacity-75">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Time Slots & Hourly Kitchen Capacity
                </span>
                <span className="text-muted-foreground block text-xs">
                  Throttle peak orders per 15-minute fulfillment slot
                </span>
              </div>
            </div>
            {/* TODO(ordering): wire kitchen order throttling (#71) */}
            <SoonBadge />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isPending}
            data-testid="discard-button"
            className="border-border hover:bg-muted active:bg-muted/80 text-foreground focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {dict.ordering.discardButton}
          </button>
          <button
            type="submit"
            disabled={isPending}
            data-testid="save-ordering-button"
            className="bg-primary hover:bg-primary/90 active:bg-primary/95 text-primary-foreground focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{dict.ordering.saveButton}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
