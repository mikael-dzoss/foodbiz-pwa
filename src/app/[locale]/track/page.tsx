import type { Metadata } from "next";
import { getDictionary, SUPPORTED_LOCALES } from "@/domain/i18n";
import { resolveStorefrontLocale, storefrontAlternates } from "@/features/storefront/metadata";
import { OrderLookupForm } from "@/features/storefront/components/order-lookup-form";
import { lookupOrderAction } from "@/features/storefront/order-lookup-action";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// No storefront loading boundary (the catalog is cached), so this navigation blocks on the page read.
export const instant = false;

export interface TrackPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: TrackPageProps): Promise<Metadata> {
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale).storefront;
  return {
    title: dict.trackTitle,
    description: dict.metaTrackDescription,
    robots: { index: false },
    alternates: storefrontAlternates(locale, "/track"),
  };
}

export default async function TrackPage({ params }: TrackPageProps) {
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale).storefront;
  return <OrderLookupForm locale={locale} dict={dict} action={lookupOrderAction} />;
}
