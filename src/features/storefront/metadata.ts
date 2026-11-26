import type { Metadata } from "next";
import { formatMoney } from "@/domain/formatting";
import {
  DEFAULT_LOCALE,
  getDictionary,
  interpolate,
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/domain/i18n";
import { PRODUCT_IMAGES_BUCKET } from "@/domain/product-image";
import type { StorefrontProductData } from "./catalog-data";

const MAX_DESCRIPTION = 160;
const MAX_OG_TITLE = 60;
const MAX_OG_DESCRIPTION = 120;
const MAX_OG_DATA_URL_LENGTH = 7_000_000;

const LOCAL_OG_IMAGE_MIMES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export const SUPPORTED_OG_IMAGE_MIMES = new Set<string>(Object.values(LOCAL_OG_IMAGE_MIMES));

/** Resolves a route `[locale]` param to a supported locale, falling back to the default locale. */
export function resolveStorefrontLocale(raw: string): SupportedLocale {
  return isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Collapses whitespace and trims to a search-snippet length. */
export function toMetaDescription(text: string | null | undefined, fallback: string): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > MAX_DESCRIPTION
    ? `${clean.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`
    : clean;
}

/** Collapses whitespace and truncates copy for Open Graph image cards. */
export function truncateOgText(text: string | null | undefined, maxLength: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
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
    applicationName: businessName,
    appleWebApp: {
      capable: true,
      title: businessName,
      statusBarStyle: "default",
    },
    manifest: `/${locale}/manifest.webmanifest`,
    openGraph: {
      title: businessName,
      description,
      siteName: businessName,
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: businessName,
      description,
    },
  };
}

/**
 * Open Graph + Twitter metadata for a public storefront child page. Includes `siteName` and
 * `locale` because Next.js shallow-merges `openGraph` and replaces parent fields.
 */
export function buildStorefrontPageSocialMetadata(options: {
  title: string;
  description: string;
  businessName: string;
  locale: SupportedLocale;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const { title, description, businessName, locale } = options;
  return {
    openGraph: {
      title,
      description,
      siteName: businessName,
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Metadata for `/[locale]/p/[id]`. Unknown or hidden products return a translated non-indexable
 * title and description without leaking product details.
 */
export function buildProductPageMetadata(options: {
  locale: SupportedLocale;
  id: string;
  productData: StorefrontProductData | null;
}): Metadata {
  const { locale, id, productData } = options;
  const dict = getDictionary(locale).storefront;

  if (!productData) {
    return {
      title: dict.notFoundTitle,
      description: dict.productNotFound,
      robots: { index: false },
    };
  }

  const { product, business } = productData;
  const description = toMetaDescription(
    product.description,
    interpolate(dict.metaDescription, { business: business.name }),
  );

  return {
    title: product.name,
    description,
    alternates: storefrontAlternates(locale, `/p/${id}`),
    ...buildStorefrontPageSocialMetadata({
      title: product.name,
      description,
      businessName: business.name,
      locale,
    }),
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

export interface ShopOgContent {
  badge: string;
  title: string;
  description: string;
  footer: string;
  monogram: string;
}

/** Builds translated copy for the shop Open Graph image card. */
export function buildShopOgContent(options: {
  businessName: string;
  description: string | null | undefined;
  address: string | null | undefined;
  locale: SupportedLocale;
}): ShopOgContent {
  const { businessName, description, address, locale } = options;
  const dict = getDictionary(locale).storefront;
  const title = truncateOgText(businessName, MAX_OG_TITLE) || businessName;
  const fallbackDescription = interpolate(dict.metaDescription, { business: title });
  const cleanDescription = truncateOgText(
    toMetaDescription(description, fallbackDescription),
    MAX_OG_DESCRIPTION,
  );
  const cleanAddress = truncateOgText(address, 60);
  const footer = cleanAddress ? `${dict.ogShopFooter} · ${cleanAddress}` : dict.ogShopFooter;
  const monogram = title.charAt(0).toUpperCase() || "F";

  return {
    badge: dict.ogShopBadge,
    title,
    description: cleanDescription,
    footer,
    monogram,
  };
}

export interface ProductOgContent {
  badge: string;
  title: string;
  description: string;
  price: string;
  businessName: string;
  footer: string;
}

/** Builds translated copy and localized price for a product Open Graph image card. */
export function buildProductOgContent(options: {
  productName: string;
  productDescription: string | null | undefined;
  priceCents: number;
  categoryName: string | null | undefined;
  businessName: string;
  locale: SupportedLocale;
}): ProductOgContent {
  const { productName, productDescription, priceCents, categoryName, businessName, locale } =
    options;
  const dict = getDictionary(locale).storefront;
  const badge = truncateOgText(categoryName, 32) || dict.ogProductBadge;
  const title = truncateOgText(productName, MAX_OG_TITLE) || productName;
  const description = truncateOgText(productDescription, MAX_OG_DESCRIPTION);
  const cleanBusiness = truncateOgText(businessName, 40) || businessName;

  return {
    badge,
    title,
    description,
    price: formatMoney(priceCents, locale),
    businessName: cleanBusiness,
    footer: interpolate(dict.ogOrderFrom, { business: cleanBusiness }),
  };
}

/**
 * Validates a local `/...` image path inside `public/` and returns its relative path and MIME type.
 * Rejects path traversal, backslashes, null bytes and unsupported image extensions.
 */
export function parseLocalPublicImagePath(
  imageUrl: string,
): { relativePath: string; mimeType: string } | null {
  if (!imageUrl.startsWith("/") || imageUrl.startsWith("//")) return null;
  if (imageUrl.includes("\\") || imageUrl.includes("\0") || imageUrl.includes("..")) return null;

  const pathname = imageUrl.split(/[?#]/, 1)[0];
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  const last = segments[segments.length - 1];
  const dotIdx = last.lastIndexOf(".");
  if (dotIdx <= 0) return null;

  const ext = last.slice(dotIdx).toLowerCase();
  const mimeType = LOCAL_OG_IMAGE_MIMES[ext];
  if (!mimeType) return null;

  return { relativePath: segments.join("/"), mimeType };
}

/** Validates an inline raster image data URL supported by Satori (`next/og`). */
export function isAllowedOgDataUrl(imageUrl: string): boolean {
  if (imageUrl.length > MAX_OG_DATA_URL_LENGTH) return false;
  return /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(imageUrl);
}

/**
 * Allows fetching remote product photos only from this project's configured Supabase
 * `product-images` public storage bucket (prevents SSRF).
 */
export function isAllowedRemoteOgImageUrl(
  imageUrl: string,
  supabaseUrl: string | undefined,
): boolean {
  if (!supabaseUrl?.trim()) return false;
  try {
    const candidate = new URL(imageUrl);
    const allowedOrigin = new URL(supabaseUrl.trim());
    if (candidate.origin !== allowedOrigin.origin) return false;
    return candidate.pathname.startsWith(`/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`);
  } catch {
    return false;
  }
}
