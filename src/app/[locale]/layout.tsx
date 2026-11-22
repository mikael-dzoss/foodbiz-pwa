import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  getDictionary,
  interpolate,
  type SupportedLocale,
} from "@/domain/i18n";
import { getStorefrontCatalog, StorefrontShell } from "@/features/storefront";
import {
  buildStorefrontRootMetadata,
  resolveStorefrontLocale,
  toMetaDescription,
} from "@/features/storefront/metadata";
import { RootDocument, rootMetadata, rootViewport } from "@/components/root-document";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// The locale param must resolve before the shell (dictionary, catalog) can render, so this layout blocks.
export const instant = false;

export interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export const viewport = rootViewport;

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const locale = resolveStorefrontLocale((await params).locale);
  const { business } = await getStorefrontCatalog();
  const fallback = interpolate(getDictionary(locale).storefront.metaDescription, {
    business: business.name,
  });
  return {
    ...rootMetadata,
    ...buildStorefrontRootMetadata({
      businessName: business.name,
      description: toMetaDescription(business.description, fallback),
      locale,
    }),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolvedParams = await params;
  // Unknown locales (/de, /xx/cart) are a real 404, not an English fallback.
  if (!isSupportedLocale(resolvedParams.locale)) notFound();
  const locale: SupportedLocale = resolvedParams.locale;

  const dict = getDictionary(locale);
  const { business, currentYear } = await getStorefrontCatalog();

  return (
    // Root layout of the storefront: <html lang> is the requested locale in the server HTML.
    <RootDocument lang={locale}>
      <div className="flex min-h-full flex-1 flex-col">
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
    </RootDocument>
  );
}
