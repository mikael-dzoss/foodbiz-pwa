import type { ReactNode } from "react";
import {
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getDictionary,
  type SupportedLocale,
} from "@/domain/i18n";
import { StorefrontShell } from "@/features/storefront";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;

  const dict = getDictionary(locale);

  return (
    <div lang={locale} className="flex min-h-full flex-1 flex-col">
      <StorefrontShell locale={locale} dict={dict.storefront} businessName="La Petite Boulangerie">
        {children}
      </StorefrontShell>
    </div>
  );
}
