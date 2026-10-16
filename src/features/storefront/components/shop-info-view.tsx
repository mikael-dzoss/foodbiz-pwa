import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  ShoppingBag,
  Truck,
  Coffee,
  MessageCircle,
} from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import type { Business, BusinessSettings } from "@/domain/business";

export interface ShopInfoViewProps {
  business: Business;
  settings: BusinessSettings | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function ShopInfoView({ business, settings, locale, dict }: ShopInfoViewProps) {
  // Service types enabled status (#83 AC)
  const pickupEnabled = settings?.serviceTypes?.pickup ?? true;
  const deliveryEnabled = settings?.serviceTypes?.delivery ?? false;
  const dineInEnabled = settings?.serviceTypes?.dineIn ?? false;
  const hasAnyService = pickupEnabled || deliveryEnabled || dineInEnabled;

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

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Back to Catalog Link */}
      <div>
        <Link
          href={`/${locale}`}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{dict.backToCatalog}</span>
        </Link>
      </div>

      {/* Store Title & Description */}
      <div className="border-border bg-card rounded-2xl border p-6">
        <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          {business.name}
        </h1>
        {business.description && (
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed sm:text-base">
            {business.description}
          </p>
        )}
      </div>

      {/* Enabled Service Types Section (#83 AC: only when set) */}
      {hasAnyService && (
        <section
          aria-labelledby="services-heading"
          className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-6"
        >
          <h2 id="services-heading" className="text-foreground text-lg font-bold tracking-tight">
            {dict.services}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {pickupEnabled && (
              <div className="border-border bg-muted/40 flex items-start gap-3 rounded-xl border p-3.5">
                <ShoppingBag className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-foreground text-sm font-semibold">
                    {dict.servicePickup}
                  </span>
                  <span className="text-muted-foreground text-xs">{dict.serviceAvailable}</span>
                </div>
              </div>
            )}

            {deliveryEnabled && (
              <div className="border-border bg-muted/40 flex items-start gap-3 rounded-xl border p-3.5">
                <Truck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-foreground text-sm font-semibold">
                    {dict.serviceDelivery}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {settings?.deliveryFee !== undefined
                      ? `${dict.deliveryFee}: ${formatMoney(settings.deliveryFee, locale)}`
                      : dict.serviceAvailable}
                  </span>
                </div>
              </div>
            )}

            {dineInEnabled && (
              <div className="border-border bg-muted/40 flex items-start gap-3 rounded-xl border p-3.5">
                <Coffee className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-foreground text-sm font-semibold">
                    {dict.serviceDineIn}
                  </span>
                  <span className="text-muted-foreground text-xs">{dict.serviceAvailable}</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Contact Channels Section (#83 AC: only when set) */}
      {(hasWhatsApp || hasPhone || hasEmail) && (
        <section
          aria-labelledby="contact-heading"
          className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-6"
        >
          <h2 id="contact-heading" className="text-foreground text-lg font-bold tracking-tight">
            {dict.contact}
          </h2>

          <div className="flex flex-col gap-3">
            {/* WhatsApp Direct Chat Button */}
            {hasWhatsApp && (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-700"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5" />
                  <span>{dict.chatOnWhatsApp}</span>
                </div>
                <span className="text-xs tabular-nums opacity-90">{business.whatsappNumber}</span>
              </a>
            )}

            {/* Direct Phone Tap-to-Call */}
            {hasPhone && (
              <a
                href={`tel:${business.phone}`}
                className="border-border hover:bg-muted flex min-h-12 items-center justify-between rounded-xl border p-3.5 text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Phone className="text-primary h-5 w-5" />
                  <span className="text-foreground font-semibold">{dict.callShop}</span>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">{business.phone}</span>
              </a>
            )}

            {/* Email Contact */}
            {hasEmail && (
              <a
                href={`mailto:${business.email}`}
                className="border-border hover:bg-muted flex min-h-12 items-center justify-between rounded-xl border p-3.5 text-sm font-medium transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Mail className="text-primary h-5 w-5" />
                  <span className="text-foreground font-semibold">{dict.emailShop}</span>
                </div>
                <span className="text-muted-foreground text-xs">{business.email}</span>
              </a>
            )}
          </div>
        </section>
      )}

      {/* Opening Hours Schedule (#83 AC: only when set) */}
      {hasOpeningHours && (
        <section
          aria-labelledby="hours-heading"
          className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-6"
        >
          <div className="flex items-center gap-2">
            <Clock className="text-primary h-5 w-5" />
            <h2 id="hours-heading" className="text-foreground text-lg font-bold tracking-tight">
              {dict.openHours}
            </h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed font-medium sm:text-base">
            {settings?.openingHours}
          </p>
        </section>
      )}

      {/* Address & Directions (#83 AC: only when set) */}
      {hasAddress && (
        <section
          aria-labelledby="address-heading"
          className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-6"
        >
          <div className="flex items-center gap-2">
            <MapPin className="text-primary h-5 w-5" />
            <h2 id="address-heading" className="text-foreground text-lg font-bold tracking-tight">
              {dict.address}
            </h2>
          </div>
          <p className="text-foreground text-sm leading-relaxed font-medium">{business.address}</p>
          {mapsUrl && (
            <div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border hover:bg-muted inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors"
              >
                <span>{dict.getDirections}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
