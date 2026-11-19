import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/domain/i18n";
import { resolveStorefrontLocale } from "@/features/storefront/metadata";
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
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale);

  // Never include private order details (order number, items, guest info) in page metadata.
  return {
    title: dict.orderTracking.title,
    description: dict.storefront.metaOrderTrackingDescription,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function OrderTrackingPage({ params }: OrderTrackingPageProps) {
  const resolved = await params;
  const locale = resolveStorefrontLocale(resolved.locale);
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
