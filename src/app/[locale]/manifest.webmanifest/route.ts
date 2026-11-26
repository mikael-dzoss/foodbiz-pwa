import type { MetadataRoute } from "next";
import { APP_METADATA } from "@/config/app";
import { getDictionary, interpolate, isSupportedLocale, SUPPORTED_LOCALES } from "@/domain/i18n";
import { getStorefrontCatalog } from "@/features/storefront/catalog-data";
import { toMetaDescription } from "@/features/storefront/metadata";

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/**
 * Web app manifest for the public customer storefront (`/[locale]`).
 *
 * Prerendered per supported locale from the cached catalog without reading request headers or
 * URL so it stays compatible with `cacheComponents`. Unknown locales return 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    return new Response(null, { status: 404 });
  }

  const { business } = await getStorefrontCatalog();
  const fallbackDescription = interpolate(getDictionary(locale).storefront.metaDescription, {
    business: business.name,
  });

  const manifest: MetadataRoute.Manifest = {
    id: APP_METADATA.storefront.manifestId,
    name: business.name,
    short_name: business.name,
    description: toMetaDescription(business.description, fallbackDescription),
    start_url: `/${locale}`,
    scope: APP_METADATA.storefront.scope,
    lang: locale,
    dir: APP_METADATA.storefront.dir,
    display: APP_METADATA.display,
    orientation: APP_METADATA.orientation,
    background_color: APP_METADATA.backgroundColor,
    theme_color: APP_METADATA.themeColor,
    icons: APP_METADATA.icons.map((icon) => ({ ...icon })),
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
