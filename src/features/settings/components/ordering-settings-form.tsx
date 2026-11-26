"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Truck,
  ShoppingBag,
  Store,
  AlertCircle,
  MapPin,
  Layers,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import { formatLeadTime, leadTimeUnitSchema, type LeadTimeUnit } from "@/domain/lead-time";
import type { SettingsDictionary } from "@/domain/i18n";
import { SELECTABLE_TIMEZONES } from "@/domain/timezone";
import { SoonBadge } from "@/components/feedback";
import {
  ActionBar,
  Button,
  Field,
  Input,
  NativeSelect,
  Switch,
  Textarea,
  useToast,
} from "@/components/ui";
import { updateOrderingSettingsAction } from "../actions";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";

export interface OrderingSettingsFormProps {
  settings: BusinessSettings;
  dict: SettingsDictionary;
  locale?: "en" | "fr";
}

export function OrderingSettingsForm({ settings, dict, locale = "en" }: OrderingSettingsFormProps) {
  const { showToast, showError } = useToast();
  const { locale: managerLocale, dict: managerDict } = useManagerLocale();
  const x = managerDict.settingsExtra;
  type SaveResult = Awaited<ReturnType<typeof updateOrderingSettingsAction>> | null;
  const [dismissed, setDismissed] = useState<SaveResult>(null);

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

  // 7. Business time zone (#168)
  const [timezone, setTimezone] = useState(settings.timezone);
  const timezoneOptions = SELECTABLE_TIMEZONES.includes(
    timezone as (typeof SELECTABLE_TIMEZONES)[number],
  )
    ? SELECTABLE_TIMEZONES
    : [timezone, ...SELECTABLE_TIMEZONES];

  // Errors

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
    setTimezone(settings.timezone);
    setDismissed(result);
    showToast(x.discarded);
  };

  const activeServiceCount = [pickup, delivery, dineIn].filter(Boolean).length;

  const [result, formAction, isPending] = useActionState(async (): Promise<SaveResult> => {
    // Client check: at least one service type must be enabled
    if (!pickup && !delivery && !dineIn) {
      showError(x.atLeastOneMode);
      return {
        ok: false,
        code: "VALIDATION",
        message: x.atLeastOneMode,
        fieldErrors: { serviceTypes: [x.atLeastOneMode] },
      };
    }

    const deliveryFeeCents = Math.round((parseFloat(deliveryFeeEuros) || 0) * 100);
    const minOrderCents = Math.round((parseFloat(minOrderEuros) || 0) * 100);

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
      timezone,
    });

    if (res.ok) {
      showToast(dict.ordering.saveSuccess);
    } else {
      showError(actionErrorMessage(res, managerLocale));
    }
    return res;
  }, null);
  const errors: Record<string, string[]> =
    result && result !== dismissed && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form
      action={formAction}
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
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{dict.ordering.title}</h1>
        <p className="text-body-sm text-muted-foreground mt-1">{dict.ordering.description}</p>
      </div>

      {/* Section 1: Store Acceptance Status */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
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
          <h2 className="text-label-sm text-muted-foreground tracking-wider uppercase">
            {dict.ordering.serviceTypesSection}
          </h2>
          <span className="text-muted-foreground text-xs font-medium">
            {interpolate(x.activeOfThree, { count: activeServiceCount })}
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

          {/* Pickup locations (#385) */}
          <Link
            href="/manage/settings/pickup-locations"
            data-testid="link-pickup-locations"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-12 items-center justify-between gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="flex items-center gap-2.5">
              <MapPin className="text-muted-foreground h-4 w-4" aria-hidden="true" />
              <span className="text-foreground text-sm font-medium">
                {dict.pickupLocations.manageLink}
              </span>
            </span>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5" aria-hidden="true" />
          </Link>

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
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.ordering.hoursSection}
        </h2>
        <div className="border-border bg-card rounded-2xl border p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="bg-muted text-muted-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <Field
                id="opening-hours-input"
                label={dict.ordering.hoursLabel}
                hint={dict.ordering.hoursHelper}
                hintPosition="above"
              >
                <Textarea
                  data-testid="input-opening-hours"
                  rows={2}
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  placeholder={x.hoursPlaceholder}
                  className="min-h-0 rounded-xl py-2"
                />
              </Field>
              <p className="text-muted-foreground mt-1 text-xs">{x.hoursEmptyHint}</p>
              {settings.weeklyHours && (
                <p
                  className="text-muted-foreground mt-1 text-xs"
                  data-testid="structured-hours-active-hint"
                >
                  {dict.openingHours.structuredActiveHint}
                </p>
              )}
              <Link
                href="/manage/settings/opening-hours"
                data-testid="link-manage-opening-hours"
                className="text-primary focus-visible:ring-ring mt-1 inline-flex min-h-9 items-center rounded text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                {dict.openingHours.manageStructuredLink}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Order Timing */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
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
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.ordering.deliverySection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-4 shadow-2xs">
          <Field
            id="delivery-fee-input"
            label={dict.ordering.deliveryFeeLabel}
            hint={dict.ordering.deliveryFeeHelper}
            hintPosition="above"
            error={errors.deliveryFee?.[0]}
          >
            {(control) => (
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium">
                  €
                </span>
                <Input
                  {...control}
                  data-testid="input-delivery-fee"
                  type="number"
                  step="0.10"
                  min="0"
                  value={deliveryFeeEuros}
                  onChange={(e) => setDeliveryFeeEuros(e.target.value)}
                  className="h-11 rounded-xl py-2 pr-3 pl-8 font-mono"
                />
              </div>
            )}
          </Field>

          <Field
            id="min-order-input"
            label={dict.ordering.minOrderLabel}
            hint={dict.ordering.minOrderHelper}
            hintPosition="above"
            error={errors.minOrderAmount?.[0]}
            className="border-border border-t pt-3"
          >
            {(control) => (
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm font-medium">
                  €
                </span>
                <Input
                  {...control}
                  data-testid="input-min-order"
                  type="number"
                  step="0.50"
                  min="0"
                  value={minOrderEuros}
                  onChange={(e) => setMinOrderEuros(e.target.value)}
                  className="h-11 rounded-xl py-2 pr-3 pl-8 font-mono"
                />
              </div>
            )}
          </Field>
        </div>
      </div>

      {/* Section 5b: Preparation lead time (#225) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
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
              <Input
                id="lead-time-value-input"
                data-testid="input-lead-time-value"
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                step="1"
                aria-label={dict.ordering.leadTimeLabel}
                aria-invalid={errors.leadTimeValue ? true : undefined}
                value={leadTimeValue}
                onChange={(e) => setLeadTimeValue(e.target.value)}
                className="h-11 w-24 shrink-0 rounded-xl py-2 font-mono"
              />
              <NativeSelect
                id="lead-time-unit-select"
                data-testid="select-lead-time-unit"
                aria-label={dict.ordering.leadTimeUnitLabel}
                value={leadTimeUnit}
                onChange={(e) => {
                  const parsed = leadTimeUnitSchema.safeParse(e.target.value);
                  if (parsed.success) setLeadTimeUnit(parsed.data);
                }}
                className="h-11 rounded-xl"
              >
                <option value="minutes">{dict.ordering.leadTimeUnitMinutes}</option>
                <option value="hours">{dict.ordering.leadTimeUnitHours}</option>
                <option value="business_days">{dict.ordering.leadTimeUnitBusinessDays}</option>
              </NativeSelect>
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
              <p
                role="alert"
                className="text-body-sm text-destructive mt-1 flex items-start gap-1.5"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errors.leadTimeValue[0]}</span>
              </p>
            )}
          </fieldset>
        </div>
      </div>

      {/* Section 5c: Business time zone (#168) */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.ordering.timezoneSection}
        </h2>
        <div className="border-border bg-card space-y-2 rounded-2xl border p-4 shadow-2xs">
          <Field
            id="timezone-select"
            label={dict.ordering.timezoneLabel}
            hint={dict.ordering.timezoneHelper}
            hintPosition="above"
            error={errors.timezone?.[0]}
          >
            <NativeSelect
              data-testid="select-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-11 rounded-xl"
            >
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>

      {/* Section 6: Upcoming Capabilities */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.ordering.soonSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  {x.soon.zonesTitle}
                </span>
                <span className="text-muted-foreground block text-xs">{x.soon.zonesDesc}</span>
              </div>
            </div>
            {/* TODO(ordering): wire live delivery zone bounds (#71) */}
            <SoonBadge />
          </div>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  {x.soon.slotsTitle}
                </span>
                <span className="text-muted-foreground block text-xs">{x.soon.slotsDesc}</span>
              </div>
            </div>
            {/* TODO(ordering): wire kitchen order throttling (#71) */}
            <SoonBadge />
          </div>
        </div>
      </div>

      {/* Sticky Save/Discard bar: above the manager bottom nav, static on desktop */}
      <ActionBar data-testid="settings-action-bar">
        <Button
          type="button"
          variant="outline"
          onClick={handleDiscard}
          disabled={isPending}
          data-testid="discard-button"
          className="flex-1 rounded-xl"
        >
          {dict.ordering.discardButton}
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          loading={isPending}
          data-testid="save-ordering-button"
          className="flex-1 rounded-xl"
        >
          {isPending ? dict.saving : dict.ordering.saveButton}
        </Button>
      </ActionBar>
    </form>
  );
}
