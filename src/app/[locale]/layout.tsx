import type { ReactNode } from "react";
import { isSupportedLocale, DEFAULT_LOCALE, type SupportedLocale } from "@/domain/i18n";

export interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;

  return (
    <div lang={locale} className="flex min-h-full flex-1 flex-col">
      {children}
    </div>
  );
}
