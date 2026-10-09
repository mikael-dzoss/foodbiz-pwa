import { enDictionary } from "./dictionaries/en";
import { frDictionary } from "./dictionaries/fr";
import { DEFAULT_LOCALE, type Dictionary, type SupportedLocale } from "./types";

const dictionaries: Record<SupportedLocale, Dictionary> = {
  en: enDictionary,
  fr: frDictionary,
};

/**
 * Returns the dictionary for the specified locale.
 * Falls back to default English dictionary if locale is unsupported.
 */
export function getDictionary(locale: SupportedLocale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
