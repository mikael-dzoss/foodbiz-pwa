import { getSiteUrl } from "@/config/site-url";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/domain/i18n";

export interface StorefrontUrlParts {
  /** Full storefront URL including protocol, e.g. `https://shop.example.com/en`. */
  fullUrl: string;
  /** Display URL without the protocol, e.g. `shop.example.com/en`. */
  displayUrl: string;
}

export interface BuildStorefrontUrlOptions {
  /** Manager's current locale; falls back to `DEFAULT_LOCALE` when unsupported. */
  locale?: string;
  /** Fallback origin when `NEXT_PUBLIC_SITE_URL` is unset (e.g. `window.location.origin`). */
  fallbackOrigin?: string;
}

/**
 * Builds the public storefront URL (`<origin>/<locale>`) from `NEXT_PUBLIC_SITE_URL`
 * or a browser fallback origin, returning `null` when neither origin is available.
 */
export function buildStorefrontUrl({
  locale,
  fallbackOrigin,
}: BuildStorefrontUrlOptions = {}): StorefrontUrlParts | null {
  const siteUrl = getSiteUrl();
  const siteOrigin = siteUrl && siteUrl.origin !== "null" ? siteUrl.origin : undefined;
  const rawOrigin = siteOrigin ?? fallbackOrigin?.trim();
  const origin = rawOrigin ? rawOrigin.replace(/\/+$/, "") : "";
  if (!origin) return null;

  const resolvedLocale: SupportedLocale =
    locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const fullUrl = `${origin}/${resolvedLocale}`;
  const displayUrl = fullUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return { fullUrl, displayUrl };
}
