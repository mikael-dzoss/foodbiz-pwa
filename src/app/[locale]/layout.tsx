import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  getDictionary,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/domain/i18n";
import { getStorefrontCatalog, StorefrontShell } from "@/features/storefront";
import { buildStorefrontRootMetadata, toMetaDescription } from "@/features/storefront/metadata";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// The locale param must resolve before the shell (dictionary, catalog) can render, so this layout blocks.
export const instant = false;

export interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale: SupportedLocale = isSupportedLocale(requested) ? requested : DEFAULT_LOCALE;
  const { business } = await getStorefrontCatalog();
  const fallback = getDictionary(locale).storefront.metaDescription.replace(
    "{business}",
    business.name,
  );
  return buildStorefrontRootMetadata({
    businessName: business.name,
    description: toMetaDescription(business.description, fallback),
    locale,
  });
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolvedParams = await params;
  // Unknown locales (/de, /xx/cart) are a real 404, not an English fallback.
  if (!isSupportedLocale(resolvedParams.locale)) notFound();
  const locale: SupportedLocale = resolvedParams.locale;

  const dict = getDictionary(locale);
  const { business, currentYear } = await getStorefrontCatalog();

  return (
    <div lang={locale} className="flex min-h-full flex-1 flex-col">
      <StorefrontShell
        locale={locale}
        dict={dict.storefront}
        businessName={business.name}
        business={business}
        currentYear={currentYear}
      >
        {children}
      </StorefrontShell>
    </div>
  );
}
