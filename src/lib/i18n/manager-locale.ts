import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  type SupportedLocale,
} from "@/domain/i18n";

/**
 * The manager UI language: the `foodbiz_locale` cookie (Account settings), `en` when absent or
 * unsupported. Reads runtime data, so call it from a dynamic segment or behind `<Suspense>`.
 */
export const getManagerLocale = cache(async (): Promise<SupportedLocale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value && isSupportedLocale(value) ? value : DEFAULT_LOCALE;
});
