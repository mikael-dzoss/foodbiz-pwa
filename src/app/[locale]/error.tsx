"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { ErrorState } from "@/components/feedback";
import { DEFAULT_LOCALE, getDictionary, isSupportedLocale } from "@/domain/i18n";

/** Storefront error boundary: a failed data read shows a retry state, never fallback data. */
export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isSupportedLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const dict = getDictionary(locale).storefront;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <ErrorState
        title={dict.pageErrorTitle}
        message={dict.pageErrorMessage}
        onRetry={retry}
        retryLabel={dict.pageErrorRetry}
        data-testid="storefront-error"
      />
    </div>
  );
}
