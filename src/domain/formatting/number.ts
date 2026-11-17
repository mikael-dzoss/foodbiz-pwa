import type { SupportedLocale } from "../i18n/types";

const INTL_LOCALES: Record<SupportedLocale, string> = { en: "en-GB", fr: "fr-FR" };

/** A percentage value (12.4 means 12.4 %) in the locale's notation: "12.4%" / "12,4 %". */
export function formatPercent(percent: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(percent / 100);
}

/** A plain number in the locale's notation (grouping and decimal separators). */
export function formatNumber(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale]).format(value);
}
