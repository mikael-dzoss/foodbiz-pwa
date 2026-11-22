"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, getDictionary, isSupportedLocale } from "@/domain/i18n";

/** Storefront not-found, localized, inside the shell (e.g. unknown or hidden product). */
export default function LocaleNotFound() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isSupportedLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const dict = getDictionary(locale).storefront;

  return (
    <div className="mx-auto max-w-xl space-y-4" data-testid="storefront-not-found">
      <EmptyState headingLevel={1} title={dict.notFoundTitle} description={dict.notFoundMessage} />
      <div className="flex justify-center">
        <Button asChild>
          <Link href={`/${locale}`} data-testid="storefront-not-found-home">
            {dict.notFoundHome}
          </Link>
        </Button>
      </div>
    </div>
  );
}
