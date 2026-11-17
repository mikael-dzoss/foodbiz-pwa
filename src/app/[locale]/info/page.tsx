import type { Metadata } from "next";
import { Suspense } from "react";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/domain/i18n";
import { storefrontAlternates } from "@/features/storefront/metadata";
import { getStorefrontCatalog, ShopInfoView } from "@/features/storefront";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// No storefront loading boundary (the catalog is cached), so this navigation blocks on the page read.
export const instant = false;

export interface ShopInfoPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ShopInfoPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale: SupportedLocale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  return {
    title: getDictionary(locale).storefront.shopInfo,
    alternates: storefrontAlternates(locale, "/info"),
  };
}

export default async function ShopInfoPage({ params }: ShopInfoPageProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  // Cached storefront business & settings query (#83)
  const catalog = await getStorefrontCatalog();

  return (
    <Suspense fallback={null}>
      <ShopInfoView
        business={catalog.business}
        settings={catalog.settings}
        locale={locale}
        dict={dict.storefront}
      />
    </Suspense>
  );
}
