import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/domain/i18n";
import { getStorefrontRepositories } from "@/lib/repositories/storefront";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { toStorefrontBusiness } from "@/domain/storefront-business";
import { OrderTrackingView } from "@/features/storefront";

export interface OrderTrackingPageProps {
  params: Promise<{ locale: string; token: string }>;
}

// Awaits route params (locale/id/token) before rendering, so a navigation here genuinely blocks.
export const instant = false;

export async function generateMetadata({ params }: OrderTrackingPageProps): Promise<Metadata> {
  const resolved = await params;
  const repos = getStorefrontRepositories();
  const order = await repos.orders.findByTrackingToken(resolved.token);

  if (!order) {
    return {
      title: "Order Tracking",
      robots: { index: false, follow: false },
      referrer: "no-referrer",
    };
  }

  return {
    title: `Order #${order.orderNumber ?? "—"} Tracking | FoodBiz`,
    description: `Track status of order #${order.orderNumber ?? "—"}`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function OrderTrackingPage({ params }: OrderTrackingPageProps) {
  const resolved = await params;
  const locale: SupportedLocale = isSupportedLocale(resolved.locale)
    ? resolved.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  const repos = getStorefrontRepositories();
  const order = await repos.orders.findByTrackingToken(resolved.token);

  if (!order) {
    notFound();
    return null;
  }

  const [business, settings] = await Promise.all([
    repos.business.findById(order.businessId),
    repos.business.getSettings(order.businessId),
  ]);

  if (!business) {
    notFound();
    return null;
  }

  return (
    <OrderTrackingView
      order={order}
      business={toStorefrontBusiness(business)}
      locale={locale}
      timeZone={settings?.timezone ?? DEFAULT_TIMEZONE}
      dict={dict.orderTracking}
      storefrontDict={dict.storefront}
    />
  );
}
