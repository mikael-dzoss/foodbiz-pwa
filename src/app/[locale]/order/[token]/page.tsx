import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/domain/i18n";
import { getRepositories } from "@/lib/repositories";
import { OrderTrackingView } from "@/features/storefront";

export const instant = false;

export interface OrderTrackingPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: OrderTrackingPageProps): Promise<Metadata> {
  const resolved = await params;
  const repos = getRepositories();
  const order = await repos.orders.findByTrackingToken(resolved.token);

  if (!order) {
    return {
      title: "Order Tracking",
    };
  }

  return {
    title: `Order #${order.orderNumber ?? "—"} Tracking | FoodBiz`,
    description: `Track status of order #${order.orderNumber ?? "—"}`,
  };
}

export default async function OrderTrackingPage({ params }: OrderTrackingPageProps) {
  const resolved = await params;
  const locale: SupportedLocale = isSupportedLocale(resolved.locale)
    ? resolved.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  const repos = getRepositories();
  const order = await repos.orders.findByTrackingToken(resolved.token);

  if (!order) {
    notFound();
    return null;
  }

  const business = await repos.business.findById(order.businessId);

  if (!business) {
    notFound();
    return null;
  }

  return (
    <OrderTrackingView
      order={order}
      business={business}
      locale={locale}
      dict={dict.orderTracking}
      storefrontDict={dict.storefront}
    />
  );
}
