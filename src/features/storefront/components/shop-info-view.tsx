"use client";

import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  Truck,
  MessageCircle,
  Store,
  Info,
  ArrowRight,
  UtensilsCrossed,
} from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import { formatLeadTime, getLeadTime } from "@/domain/lead-time";
import { interpolate } from "@/domain/i18n";
import { rangesForDate } from "@/domain/opening-hours";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { HoursSummary } from "@/features/settings/components/opening-hours";
import { useZonedToday } from "@/components/time/business-timezone";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import { buildOpenStreetMapEmbedUrl, type BusinessSettings } from "@/domain/business";
import type { StorefrontBusiness } from "@/domain/storefront-business";
import { SoonBadge } from "@/components/feedback";
import { ActionBar } from "@/components/ui/action-bar";
import { cn } from "@/lib/utils";

export interface ShopInfoViewProps {
  business: StorefrontBusiness;
  settings: BusinessSettings | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function ShopInfoView({ business, settings, locale, dict }: ShopInfoViewProps) {
  const paymentMethods = settings?.paymentMethods ?? {
    cash: true,
    card: false,
    revolut: true,
    wero: true,
  };
  const enabledPaymentBadges: readonly { id: string; label: string }[] = [
    ...(paymentMethods.cash ? [{ id: "cash", label: dict.cashOnPickup }] : []),
    ...(paymentMethods.card ? [{ id: "card", label: dict.cardOnPickup }] : []),
    ...(paymentMethods.revolut ? [{ id: "revolut", label: dict.revolutPay }] : []),
    ...(paymentMethods.wero ? [{ id: "wero", label: "Wero" }] : []),
  ];

  // Service types enabled status (#83 AC)
  const pickupEnabled = settings?.serviceTypes?.pickup ?? true;
  const leadTimeText = formatLeadTime(getLeadTime(settings), locale);
  const deliveryEnabled = settings?.serviceTypes?.delivery ?? false;

  // Contact items (rendered ONLY when set - #83 AC)
  const hasPhone = Boolean(business.phone?.trim());
  const hasEmail = Boolean(business.email?.trim());
  const hasWhatsApp = Boolean(business.whatsappNumber?.trim());
  const hasAddress = Boolean(business.address?.trim());
  const weeklyHours = settings?.weeklyHours ?? null;
  const hoursExceptions = settings?.hoursExceptions ?? [];
  const hasStructuredHours = weeklyHours !== null || hoursExceptions.length > 0;
  const hasOpeningHours = Boolean(settings?.openingHours?.trim()) || hasStructuredHours;

  // WhatsApp clean link (strip spaces, dashes, parentheses)
  const cleanWhatsAppNumber = business.whatsappNumber?.replace(/[^\d+]/g, "") ?? "";
  const whatsAppUrl = cleanWhatsAppNumber
    ? `https://wa.me/${cleanWhatsAppNumber.replace("+", "")}`
    : "";

  // Google Maps directions url
  const mapsUrl = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
    : "";

  const hasCoordinates =
    typeof business.latitude === "number" &&
    Number.isFinite(business.latitude) &&
    typeof business.longitude === "number" &&
    Number.isFinite(business.longitude);
  const osmEmbedUrl = hasCoordinates
    ? buildOpenStreetMapEmbedUrl(business.latitude!, business.longitude!)
    : null;

  // Days for the weekly schedule
  const days = [
    { key: "monday", label: "Monday", fr: "Lundi" },
    { key: "tuesday", label: "Tuesday", fr: "Mardi" },
    { key: "wednesday", label: "Wednesday", fr: "Mercredi" },
    { key: "thursday", label: "Thursday", fr: "Jeudi" },
    { key: "friday", label: "Friday", fr: "Vendredi" },
    { key: "saturday", label: "Saturday", fr: "Samedi" },
    { key: "sunday", label: "Sunday", fr: "Dimanche" },
  ];

  // Today in the business zone (null until hydrated, so server and client render the same)
  const today = useZonedToday(settings?.timezone ?? DEFAULT_TIMEZONE);
  // JS weekday (0=Sun, 1=Mon...6=Sat) mapped to our Monday-indexed list; -1 = unknown yet
  const currentDayIndex = today ? new Date(`${today}T12:00:00Z`).getUTCDay() : -1;
  const currentMondayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;

  const isOpen = settings?.acceptingOrders ?? true;

  // Today's exceptional day (holiday / special hours) with its note, shown on that day only (#375)
  const todayHours =
    today && hasStructuredHours
      ? rangesForDate({ weekly: weeklyHours, exceptions: hoursExceptions }, today)
      : null;
  const todayException = todayHours?.source === "exception" ? todayHours : null;
  const todayExceptionText = todayException
    ? todayException.ranges.length === 0
      ? dict.todayExceptionClosed
      : interpolate(dict.todayExceptionOpen, {
          hours: todayException.ranges.map((r) => `${r.open}–${r.close}`).join(" · "),
        })
    : null;

  // Ordering policy tiles: amounts only when configured, never invented (#302)
  const policyTiles = [
    settings?.minOrderAmount != null
      ? {
          id: "min-order",
          label: dict.policyMinOrder,
          value: formatMoney(settings.minOrderAmount, locale),
        }
      : null,
    settings?.deliveryFee != null
      ? {
          id: "delivery-fee",
          label: dict.policyDeliveryFee,
          value: formatMoney(settings.deliveryFee, locale),
        }
      : null,
    // Lead time is a domain rule with a documented default (DEFAULT_LEAD_TIME), shown the same in checkout.
    { id: "est-time", label: dict.policyEstTime, value: leadTimeText },
  ].filter((tile): tile is { id: string; label: string; value: string } => tile !== null);

  const policyGridClassName =
    policyTiles.length === 1
      ? "grid grid-cols-1 gap-2 text-xs"
      : policyTiles.length === 2
        ? "grid grid-cols-2 gap-2 text-xs"
        : "grid grid-cols-2 gap-2 text-xs sm:grid-cols-3";

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Store Header & Identity Bento Card (Stitch C-03) */}
      <section
        id="overview"
        aria-labelledby="overview-heading"
        className="border-border/80 bg-card flex scroll-mt-20 flex-col gap-3.5 rounded-xl border p-4 shadow-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="border-border/60 bg-muted text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border font-bold">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                {business.address?.split(",")[1]?.trim() && (
                  <span className="text-muted-foreground text-micro font-medium">
                    {business.address.split(",")[1].trim()}
                  </span>
                )}
              </div>
              <h1 id="overview-heading" className="text-title-lg text-foreground mt-0.5">
                {business.name}
              </h1>
            </div>
          </div>

          <div
            className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold ${
              isOpen
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isOpen ? "bg-emerald-600" : "bg-muted-foreground"}`}
            />
            <span>{isOpen ? dict.storeOpenBadge : dict.storeClosedBadge}</span>
          </div>
        </div>

        {business.description && (
          <p className="text-muted-foreground text-xs leading-relaxed">{business.description}</p>
        )}

        {/* Fulfilment Quick Chips Grid (Stitch C-03) */}
        {(pickupEnabled || deliveryEnabled) && (
          <div className="border-border/60 grid grid-cols-2 gap-2 border-t pt-2">
            <span className="sr-only">{dict.services}</span>
            {pickupEnabled && (
              <div className="border-border/40 bg-muted/40 flex flex-col justify-between rounded-lg border p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-caption font-semibold">
                    {dict.servicePickup}
                  </span>
                  <span className="bg-primary/15 text-primary text-micro rounded px-1.5 font-bold">
                    {dict.serviceFree ?? "FREE"}
                  </span>
                </div>
                <p className="text-muted-foreground text-caption mt-1 tabular-nums">
                  {dict.pickupReadyTime.replace("{leadTime}", leadTimeText)}
                </p>
              </div>
            )}

            {deliveryEnabled && (
              <div className="border-border/40 bg-muted/40 flex flex-col justify-between rounded-lg border p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-caption font-semibold">
                    {dict.serviceDelivery}
                  </span>
                  <span className="bg-muted text-muted-foreground text-micro rounded px-1.5 font-bold">
                    {dict.servicePaid ?? "PAID"}
                  </span>
                </div>
                <p className="text-muted-foreground text-caption mt-1 tabular-nums">
                  {settings?.deliveryFee !== undefined
                    ? `${dict.deliveryFee}: ${formatMoney(settings.deliveryFee, locale)}`
                    : dict.serviceAvailable}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Direct Contact & Orders (Stitch C-03) */}
      {(hasWhatsApp || hasPhone || hasEmail) && (
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="flex scroll-mt-20 flex-col gap-2"
        >
          <h2
            id="contact-heading"
            className="text-label-sm text-muted-foreground px-1 tracking-wider uppercase"
          >
            {dict.contact}
          </h2>

          {/* WhatsApp CTA */}
          {hasWhatsApp && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group text-foreground border-whatsapp/30 bg-whatsapp/10 hover:bg-whatsapp/15 flex items-center justify-between rounded-lg border p-3.5 transition-all duration-150 active:scale-99"
            >
              <div className="flex items-center gap-3">
                <div className="bg-whatsapp flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white">
                  <MessageCircle className="h-5 w-5 fill-current" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">
                      {dict.chatOnWhatsApp}
                    </span>
                    <span className="bg-whatsapp text-micro rounded px-1.5 font-bold text-white">
                      {dict.fastReply}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {business.whatsappNumber}
                  </p>
                </div>
              </div>
              <ArrowRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}

          {/* Phone & Email Dual Card Grid */}
          {(hasPhone || hasEmail) && (
            <div className="grid grid-cols-2 gap-2">
              {hasPhone && (
                <a
                  href={`tel:${business.phone}`}
                  className="border-border/70 bg-card hover:bg-muted flex flex-col justify-between rounded-lg border p-3 transition-colors active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <Phone className="text-primary h-4 w-4" />
                    <span className="text-primary text-micro font-semibold">{dict.callShop}</span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-muted-foreground text-caption tabular-nums">
                      {business.phone}
                    </p>
                  </div>
                </a>
              )}

              {hasEmail && (
                <a
                  href={`mailto:${business.email}`}
                  className="border-border/70 bg-card hover:bg-muted flex flex-col justify-between rounded-lg border p-3 transition-colors active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <Mail className="text-primary h-4 w-4" />
                    <span className="text-primary text-micro font-semibold">{dict.emailShop}</span>
                  </div>
                  <div className="mt-2.5 truncate">
                    <p className="text-muted-foreground text-caption truncate">{business.email}</p>
                  </div>
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {/* 3. Weekly Opening Hours Table (Stitch C-03) */}
      {hasOpeningHours && (
        <section
          id="hours"
          aria-labelledby="hours-heading"
          className="border-border/80 bg-card flex scroll-mt-20 flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex items-center gap-2">
            <Clock className="text-primary h-4 w-4" />
            <h2 id="hours-heading" className="text-title-sm text-foreground">
              {dict.weeklyOpeningHours}
            </h2>
            <span className="sr-only">{dict.openHours}</span>
          </div>

          {todayExceptionText && (
            <div
              data-testid="today-exception"
              className="border-border/50 bg-muted/60 text-foreground text-caption flex items-start gap-2 rounded-lg border p-2.5"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">{todayExceptionText}</p>
                {todayException?.note && (
                  <p className="text-muted-foreground">{todayException.note}</p>
                )}
              </div>
            </div>
          )}

          {hasStructuredHours ? (
            <HoursSummary
              weekly={weeklyHours}
              exceptions={hoursExceptions}
              locale={locale}
              timeZone={settings?.timezone ?? DEFAULT_TIMEZONE}
              highlightToday
              fallbackText={settings?.openingHours}
              labels={{
                closed: dict.storeClosedBadge,
                todayBadge: dict.today,
                upcomingExceptionsTitle: dict.upcomingExceptionsTitle,
              }}
            />
          ) : (
            <>
              <div className="border-border/40 divide-border/40 divide-y border-t text-xs">
                {days.map((day, idx) => {
                  const isToday = idx === currentMondayIndex;
                  const isSunday = idx === 6;
                  return (
                    <div
                      key={day.key}
                      className={`flex items-center justify-between py-2 ${
                        isToday ? "text-foreground font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{locale === "fr" ? day.fr : day.label}</span>
                        {isToday && (
                          <span className="bg-primary text-primary-foreground text-micro rounded px-1.5 font-semibold">
                            {dict.today}
                          </span>
                        )}
                      </div>
                      <span className="font-normal tabular-nums">
                        {isSunday ? "08:00 – 13:00" : "07:30 – 19:30"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* TODO(business): Dynamic holiday closures & seasonal calendar exceptions (#83) */}
              <div className="border-border/50 bg-muted/60 text-muted-foreground text-caption flex items-start justify-between gap-2 rounded-lg border p-2.5">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{dict.holidayScheduleNotice}</span>
                </div>
                <SoonBadge />
              </div>
            </>
          )}
        </section>
      )}

      {/* 4. Physical Address & Map Snippet Card (Stitch C-03) */}
      {hasAddress && (
        <section
          id="location"
          aria-labelledby="address-heading"
          className="border-border/80 bg-card flex scroll-mt-20 flex-col overflow-hidden rounded-xl border"
        >
          {osmEmbedUrl ? (
            <div className="p-4 pb-0">
              <div className="border-border bg-muted relative h-44 w-full overflow-hidden rounded-lg border">
                <iframe
                  src={osmEmbedUrl}
                  title={dict.mapEmbedTitle.replace("{business}", business.name)}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  data-testid="shop-info-osm-map"
                  className="h-full w-full rounded-lg border-0"
                />
              </div>
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="osm-attribution-link"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-1 inline-flex min-h-6 items-center rounded text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-hidden"
              >
                {dict.osmAttribution}
              </a>
            </div>
          ) : (
            /* Visual Map Placeholder Graphic Snippet */
            <div
              data-testid="shop-info-map-placeholder"
              className="bg-muted/80 border-border relative flex h-32 w-full items-center justify-center overflow-hidden border-b"
            >
              <div className="bg-dot-grid absolute inset-0 opacity-30" />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 via-transparent to-transparent p-3">
                <span className="text-caption flex items-center gap-1.5 font-semibold text-white">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  {business.address?.split(",")[1]?.trim() ?? business.name}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 p-4">
            <div>
              <h2 id="address-heading" className="sr-only">
                {dict.address}
              </h2>
              <p className="text-foreground text-xs leading-snug font-semibold">
                {business.address}
              </p>
            </div>

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-muted text-foreground flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition-colors active:scale-99"
              >
                <MapPin className="text-primary h-4 w-4" />
                <span>{dict.getDirections}</span>
                <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* 5. Delivery & Ordering Policy Card (Stitch C-03) */}
      <section
        id="ordering-policy"
        aria-labelledby="ordering-policy-heading"
        className="border-border/80 bg-card flex scroll-mt-20 flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex items-center gap-2">
          <Truck className="text-primary h-4 w-4" />
          <h2 id="ordering-policy-heading" className="text-title-sm text-foreground">
            {dict.deliveryPolicy}
          </h2>
        </div>

        {policyTiles.length > 0 && (
          <div data-testid="ordering-policy-grid" className={policyGridClassName}>
            {policyTiles.map((tile, index) => (
              <div
                key={tile.id}
                data-testid={`policy-tile-${tile.id}`}
                className={cn(
                  "border-border/40 bg-muted/40 rounded-lg border p-2.5",
                  policyTiles.length === 3 && index === 2 && "col-span-2 sm:col-span-1",
                )}
              >
                <span className="text-muted-foreground text-micro block uppercase">
                  {tile.label}
                </span>
                <span className="text-foreground mt-0.5 block text-xs font-bold tabular-nums">
                  {tile.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Accepted Payment Methods */}
        <div className="border-border/50 border-t pt-2">
          <span className="text-muted-foreground text-caption mb-2 block font-semibold">
            {dict.acceptedPayments}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {enabledPaymentBadges.map((badge) => (
              <span
                key={badge.id}
                data-testid={`shop-payment-${badge.id}`}
                className="border-border/40 bg-muted/60 text-foreground text-caption rounded border px-2 py-1 font-medium"
              >
                {badge.label}
              </span>
            ))}
            {/* TODO(payments): Tap to pay with Apple Pay & Google Wallet (#72) */}
            <span
              data-testid="shop-payment-wallet-tap"
              className="border-border/60 bg-muted text-muted-foreground text-caption flex items-center gap-1 rounded border px-2 py-1"
            >
              <span>{dict.walletTapSoon}</span>
              <SoonBadge />
            </span>
          </div>
        </div>
      </section>

      {/* In-flow sticky actions bar: settles above the footer at the end of the content (#249) */}
      <ActionBar
        placement="floating"
        contentClassName="flex items-center"
        data-testid="shop-info-action-bar"
      >
        <Link
          href={`/${locale}`}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold shadow-xs transition-all active:scale-98"
        >
          <UtensilsCrossed className="h-4.5 w-4.5" />
          <span>{dict.returnToCatalog}</span>
        </Link>
      </ActionBar>
    </div>
  );
}
