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
import { getStorefrontCatalog, CheckoutView } from "@/features/storefront";

// Awaits route params (locale/id/token) before rendering, so a navigation here genuinely blocks.
export const instant = false;

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export interface CheckoutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale: SupportedLocale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  return {
    title: getDictionary(locale).storefront.checkoutTitle,
    robots: { index: false },
    alternates: storefrontAlternates(locale, "/checkout"),
  };
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  // Cached storefront catalog & settings query (#80, #86)
  const catalog = await getStorefrontCatalog();

  return (
    <Suspense fallback={null}>
      <CheckoutView
        business={catalog.business}
        settings={catalog.settings}
        locale={locale}
        dict={dict.storefront}
      />
    </Suspense>
  );
}
