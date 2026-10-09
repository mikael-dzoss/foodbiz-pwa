import { APP_METADATA } from "@/config/app";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/domain/i18n";

export interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

export default async function LocaleHomePage({ params }: LocalePageProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">{APP_METADATA.name}</h1>
      <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
        {APP_METADATA.description}
      </p>
      <p className="text-sm text-zinc-500">
        {dict.storefront.openHours} · {locale.toUpperCase()}
      </p>
    </main>
  );
}
