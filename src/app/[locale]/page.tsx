import type { Metadata } from "next";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/domain/i18n";
import { storefrontAlternates } from "@/features/storefront/metadata";
import { getStorefrontCatalog, StorefrontCatalogView } from "@/features/storefront";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// No storefront loading boundary (the catalog is cached), so this navigation blocks on the page read.
export const instant = false;

export interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale: SupportedLocale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  return { alternates: storefrontAlternates(locale) };
}

export default async function LocaleHomePage({ params }: LocalePageProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  // Server-rendered, cached catalog query with 'use cache' (#80, #82)
  const catalog = await getStorefrontCatalog();

  return <StorefrontCatalogView catalog={catalog} locale={locale} dict={dict.storefront} />;
}
