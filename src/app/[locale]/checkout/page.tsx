import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import {
  getDictionary,
  SUPPORTED_LOCALES,
  type StorefrontDictionary,
  type SupportedLocale,
} from "@/domain/i18n";
import { resolveStorefrontLocale, storefrontAlternates } from "@/features/storefront/metadata";
import {
  evaluateStoreOperatingStatus,
  getStorefrontCatalog,
  CheckoutView,
  type StorefrontCatalogData,
} from "@/features/storefront";

// Awaits route params (locale/id/token) before rendering, so a navigation here genuinely blocks.
export const instant = false;

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export interface CheckoutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale).storefront;
  return {
    title: dict.checkoutTitle,
    description: dict.metaCheckoutDescription,
    robots: { index: false },
    alternates: storefrontAlternates(locale, "/checkout"),
  };
}

async function CheckoutContent({
  catalog,
  locale,
  dict,
}: {
  catalog: StorefrontCatalogData;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}) {
  await connection();
  const { isOpen, isAcceptingOrders } = evaluateStoreOperatingStatus(catalog.settings, new Date());

  return (
    <CheckoutView
      business={catalog.business}
      settings={catalog.settings}
      locale={locale}
      dict={dict}
      isOpen={isOpen}
      isAcceptingOrders={isAcceptingOrders}
    />
  );
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale);

  // Cached storefront catalog & settings query (#80, #86)
  const catalog = await getStorefrontCatalog();

  return (
    <Suspense fallback={null}>
      <CheckoutContent catalog={catalog} locale={locale} dict={dict.storefront} />
    </Suspense>
  );
}
