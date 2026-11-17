import type { Metadata } from "next";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/domain/i18n";
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

function resolveLocale(raw: string): SupportedLocale {
  return isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;
}

export async function generateMetadata({ params }: TrackPageProps): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  return { title: getDictionary(locale).storefront.trackTitle, robots: { index: false } };
}

export default async function TrackPage({ params }: TrackPageProps) {
  const locale = resolveLocale((await params).locale);
  const dict = getDictionary(locale).storefront;
  return <OrderLookupForm locale={locale} dict={dict} action={lookupOrderAction} />;
}
