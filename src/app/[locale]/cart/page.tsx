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
import { getStorefrontCatalog, CartView } from "@/features/storefront";

// Awaits route params (locale/id/token) before rendering, so a navigation here genuinely blocks.
export const instant = false;

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export interface CartPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CartPageProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale: SupportedLocale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  return {
    title: getDictionary(locale).storefront.yourCart,
    robots: { index: false },
    alternates: storefrontAlternates(locale, "/cart"),
  };
}

export default async function CartPage({ params }: CartPageProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  // Cached storefront settings query (#80, #85)
  const catalog = await getStorefrontCatalog();

  return (
    <Suspense fallback={null}>
      <CartView
        locale={locale}
        dict={dict.storefront}
        minOrderAmount={catalog.settings?.minOrderAmount ?? 0}
        isAcceptingOrders={catalog.isAcceptingOrders}
      />
    </Suspense>
  );
}
