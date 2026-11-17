import type { Metadata } from "next";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale } from "@/domain/i18n";

const MAX_DESCRIPTION = 160;

/** Collapses whitespace and trims to a search-snippet length. */
export function toMetaDescription(text: string | null | undefined, fallback: string): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > MAX_DESCRIPTION
    ? `${clean.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`
    : clean;
}

/**
 * Storefront root metadata: the business name is the default title and the suffix of every
 * storefront page title ("Menu · Business"), applied once by the template.
 */
export function buildStorefrontRootMetadata(options: {
  businessName: string;
  description: string;
  locale: SupportedLocale;
}): Metadata {
  const { businessName, description, locale } = options;
  return {
    title: { default: businessName, template: `%s · ${businessName}` },
    description,
    openGraph: { siteName: businessName, locale, type: "website" },
  };
}

/**
 * Canonical + hreflang alternates for a locale-prefixed storefront path (`""` is the home page).
 * Paths are relative; `metadataBase` in the root layout makes them absolute.
 */
export function storefrontAlternates(
  locale: SupportedLocale,
  path = "",
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}${path}`])),
      "x-default": `/${DEFAULT_LOCALE}${path}`,
    },
  };
}
