import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, getDictionary, isSupportedLocale } from "@/domain/i18n";
import { getStorefrontRepositories } from "@/lib/repositories/storefront";
import { OrderConfirmationView } from "@/features/storefront/components/order-confirmation-view";

interface ConfirmationPageProps {
  params: Promise<{ locale: string; token: string }>;
}

// Awaits route params (locale/id/token) before rendering, so a navigation here genuinely blocks.
export const instant = false;

export async function generateMetadata({ params }: ConfirmationPageProps): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(isSupportedLocale(locale) ? locale : DEFAULT_LOCALE);
  return {
    title: dict.orderConfirmation.title,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { locale: requestedLocale, token } = await params;
  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const repos = getStorefrontRepositories();
  const order = await repos.orders.findByTrackingToken(token);
  if (!order) return notFound();
  const business = await repos.business.findById(order.businessId);
  if (!business) return notFound();
  const settings = await repos.business.getSettings(order.businessId);

  return (
    <OrderConfirmationView
      order={order}
      settings={settings}
      businessName={business.name}
      token={token}
      locale={locale}
      dict={getDictionary(locale)}
    />
  );
}
