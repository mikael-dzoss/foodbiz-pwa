import { Suspense } from "react";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/domain/i18n";
import { getStorefrontCatalog, CartView } from "@/features/storefront";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const instant = false;

export interface CartPageProps {
  params: Promise<{ locale: string }>;
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
