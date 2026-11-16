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
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import { buildOpenStreetMapEmbedUrl, type BusinessSettings } from "@/domain/business";
import type { StorefrontBusiness } from "@/domain/storefront-business";
import { SoonBadge } from "@/components/feedback";

export interface ShopInfoViewProps {
  business: StorefrontBusiness;
  settings: BusinessSettings | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function ShopInfoView({ business, settings, locale, dict }: ShopInfoViewProps) {
  // Service types enabled status (#83 AC)
  const pickupEnabled = settings?.serviceTypes?.pickup ?? true;
  const leadTimeText = formatLeadTime(getLeadTime(settings), locale);
  const deliveryEnabled = settings?.serviceTypes?.delivery ?? false;

  // Contact items (rendered ONLY when set - #83 AC)
  const hasPhone = Boolean(business.phone?.trim());
  const hasEmail = Boolean(business.email?.trim());
  const hasWhatsApp = Boolean(business.whatsappNumber?.trim());
  const hasAddress = Boolean(business.address?.trim());
  const hasOpeningHours = Boolean(settings?.openingHours?.trim());

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

  // Current day index (0 is Sunday, 1 is Monday...)
  const currentDayIndex = new Date().getDay();
  // Map JS getDay (0=Sun, 1=Mon...6=Sat) to our Monday-indexed list
  const currentMondayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;

  const isOpen = settings?.acceptingOrders ?? true;

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
                <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                  Bio &amp; Artisanal
                </span>
                <span className="text-muted-foreground text-[10px] font-medium">
                  {business.address?.split(",")[1]?.trim() ?? "Paris 11e"}
                </span>
              </div>
              <h1
                id="overview-heading"
                className="text-foreground mt-0.5 text-lg leading-snug font-bold tracking-tight"
              >
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
                  <span className="text-foreground text-[11px] font-semibold">
                    {dict.servicePickup}
                  </span>
                  <span className="bg-primary/15 text-primary py-0.2 rounded px-1.5 text-[10px] font-bold">
                    {dict.serviceFree ?? "FREE"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
                  {dict.pickupReadyTime.replace("{leadTime}", leadTimeText)}
                </p>
              </div>
            )}

            {deliveryEnabled && (
              <div className="border-border/40 bg-muted/40 flex flex-col justify-between rounded-lg border p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-[11px] font-semibold">
                    {dict.serviceDelivery}
                  </span>
                  <span className="bg-muted text-muted-foreground py-0.2 rounded px-1.5 text-[10px] font-bold">
                    {dict.servicePaid ?? "PAID"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
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
            className="text-muted-foreground px-1 text-xs font-semibold tracking-wider uppercase"
          >
            {dict.contact}
          </h2>

          {/* WhatsApp CTA */}
          {hasWhatsApp && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${dict.chatOnWhatsApp}: ${business.whatsappNumber}`}
              className="group text-foreground flex items-center justify-between rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 p-3.5 transition-all duration-150 hover:bg-[#25D366]/15 active:scale-99"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <MessageCircle className="h-5 w-5 fill-current" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">
                      {dict.chatOnWhatsApp}
                    </span>
                    <span className="py-0.2 rounded bg-[#25D366] px-1.5 text-[10px] font-bold text-white">
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
                  aria-label={`${dict.callShop}: ${business.phone}`}
                  className="border-border/70 bg-card hover:bg-muted flex flex-col justify-between rounded-lg border p-3 transition-colors active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <Phone className="text-primary h-4 w-4" />
                    <span className="text-primary text-[10px] font-semibold">{dict.callShop}</span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-foreground text-xs font-semibold">Bakery Counter</p>
                    <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                      {business.phone}
                    </p>
                  </div>
                </a>
              )}

              {hasEmail && (
                <a
                  href={`mailto:${business.email}`}
                  aria-label={`${dict.emailShop}: ${business.email}`}
                  className="border-border/70 bg-card hover:bg-muted flex flex-col justify-between rounded-lg border p-3 transition-colors active:scale-98"
                >
                  <div className="flex items-center justify-between">
                    <Mail className="text-primary h-4 w-4" />
                    <span className="text-primary text-[10px] font-semibold">{dict.emailShop}</span>
                  </div>
                  <div className="mt-2.5 truncate">
                    <p className="text-foreground text-xs font-semibold">Custom Orders</p>
                    <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                      {business.email}
                    </p>
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
            <h2 id="hours-heading" className="text-foreground font-headline text-sm font-semibold">
              {dict.weeklyOpeningHours}
            </h2>
            <span className="sr-only">{dict.openHours}</span>
          </div>

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
                      <span className="bg-primary text-primary-foreground py-0.2 rounded px-1.5 text-[10px] font-semibold">
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
          <div className="border-border/50 bg-muted/60 text-muted-foreground flex items-start justify-between gap-2 rounded-lg border p-2.5 text-[11px]">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{dict.holidayScheduleNotice}</span>
            </div>
            <SoonBadge />
          </div>
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
              <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 via-transparent to-transparent p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  {business.address?.split(",")[1]?.trim() ?? "Paris 11e"}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 p-4">
            <div>
              <h2 id="address-heading" className="sr-only">
                {dict.address}
              </h2>
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Bakery &amp; Flour Lab
              </span>
              <p className="text-foreground mt-0.5 text-xs leading-snug font-semibold">
                {business.address}
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Métro: Bastille (Lines 1, 5, 8) or Voltaire (Line 9)
              </p>
            </div>

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={dict.getDirections}
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
          <h2
            id="ordering-policy-heading"
            className="text-foreground font-headline text-sm font-semibold"
          >
            {dict.deliveryPolicy}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border-border/40 bg-muted/40 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[10px] uppercase">Min. Order</span>
            <span className="text-foreground mt-0.5 block text-xs font-bold tabular-nums">
              {formatMoney(settings?.minOrderAmount ?? 1500, locale)}
            </span>
          </div>

          <div className="border-border/40 bg-muted/40 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[10px] uppercase">Delivery Fee</span>
            <span className="text-foreground mt-0.5 block text-xs font-bold tabular-nums">
              {formatMoney(settings?.deliveryFee ?? 250, locale)}{" "}
              <span className="text-muted-foreground text-[10px] font-normal">(Free &gt; €40)</span>
            </span>
          </div>

          <div className="border-border/40 bg-muted/40 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[10px] uppercase">Est. Time</span>
            <span className="text-foreground mt-0.5 block text-xs font-bold tabular-nums">
              {leadTimeText}
            </span>
          </div>

          <div className="border-border/40 bg-muted/40 rounded-lg border p-2.5">
            <span className="text-muted-foreground block text-[10px] uppercase">Coverage</span>
            <span className="text-foreground mt-0.5 block truncate text-xs font-bold">
              Paris 11e, 10e, 12e
            </span>
          </div>
        </div>

        {/* Accepted Payment Methods */}
        <div className="border-border/50 border-t pt-2">
          <span className="text-muted-foreground mb-2 block text-[11px] font-semibold">
            {dict.acceptedPayments}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="border-border/40 bg-muted/60 text-foreground rounded border px-2 py-1 text-[11px] font-medium">
              {dict.cashOnPickup}
            </span>
            <span className="border-border/40 bg-muted/60 text-foreground rounded border px-2 py-1 text-[11px] font-medium">
              Revolut Pay
            </span>
            <span className="border-border/40 bg-muted/60 text-foreground rounded border px-2 py-1 text-[11px] font-medium">
              Wero / Paylib
            </span>
            {/* TODO(payments): Tap to pay with Apple Pay & Google Wallet (#72) */}
            <span className="border-border/60 bg-muted text-muted-foreground flex items-center gap-1 rounded border px-2 py-1 text-[11px]">
              <span>Card Tap</span>
              <SoonBadge />
            </span>
          </div>
        </div>
      </section>

      {/* In-flow sticky actions bar: settles above the footer at the end of the content (#249) */}
      <div
        data-testid="shop-info-action-bar"
        className="border-border bg-card/95 sticky bottom-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] z-30 -mt-3 rounded-xl border p-3 shadow-lg backdrop-blur-md dark:shadow-black/40"
      >
        <div className="mx-auto flex max-w-4xl items-center">
          <Link
            href={`/${locale}`}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold shadow-xs transition-all active:scale-98"
          >
            <UtensilsCrossed className="h-4.5 w-4.5" />
            <span>{dict.returnToCatalog}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
