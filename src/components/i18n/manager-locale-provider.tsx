"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  getDictionary,
  type Dictionary,
  type SupportedLocale,
} from "@/domain/i18n";

export interface ManagerLocaleValue {
  locale: SupportedLocale;
  dict: Dictionary;
}

/** English by default so a component rendered without a provider (tests, previews) still reads. */
const ManagerLocaleContext = createContext<ManagerLocaleValue>({
  locale: DEFAULT_LOCALE,
  dict: getDictionary(DEFAULT_LOCALE),
});

/**
 * Carries the manager's locale to client components. Mount it with `key={locale}`: the value of
 * one instance never changes after its first render (a context change above a Suspense boundary
 * would force React to client-render boundaries that are still streaming), so switching language
 * remounts the subtree instead.
 */
export function ManagerLocaleProvider({
  locale,
  children,
}: {
  locale: SupportedLocale;
  children: ReactNode;
}) {
  const value: ManagerLocaleValue = { locale, dict: getDictionary(locale) };
  return <ManagerLocaleContext value={value}>{children}</ManagerLocaleContext>;
}

export function useManagerLocale(): ManagerLocaleValue {
  return useContext(ManagerLocaleContext);
}

/**
 * Keeps `<html lang>` on the active locale. The root layout is static (cacheComponents) and cannot
 * read the cookie, so the manager area (noindex) syncs it after hydration.
 */
export function HtmlLangSync({ locale }: { locale: SupportedLocale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
