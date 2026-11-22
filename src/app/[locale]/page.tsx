import type { Metadata } from "next";
import { getDictionary, SUPPORTED_LOCALES } from "@/domain/i18n";
import { resolveStorefrontLocale, storefrontAlternates } from "@/features/storefront/metadata";
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
  const locale = resolveStorefrontLocale((await params).locale);
  return { alternates: storefrontAlternates(locale) };
}

export default async function LocaleHomePage({ params }: LocalePageProps) {
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale);

  // Server-rendered, cached catalog query with 'use cache' (#80, #82)
  const catalog = await getStorefrontCatalog();

  return <StorefrontCatalogView catalog={catalog} locale={locale} dict={dict.storefront} />;
}
