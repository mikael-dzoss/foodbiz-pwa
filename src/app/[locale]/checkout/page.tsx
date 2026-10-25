import { Suspense } from "react";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/domain/i18n";
import { getStorefrontCatalog, CheckoutView } from "@/features/storefront";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const instant = false;

export interface CheckoutPageProps {
  params: Promise<{ locale: string }>;
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
