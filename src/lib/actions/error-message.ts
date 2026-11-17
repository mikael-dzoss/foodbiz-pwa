import { DEFAULT_LOCALE, getDictionary, type SupportedLocale } from "@/domain/i18n";
import type { ActionFailure } from "./types";

/**
 * Localized, user-safe text for a failed Server Action result. Never shows the server's
 * `message`: a known domain `reason` wins, otherwise a generic message for the failure `code`.
 * Client-safe (pure; dictionaries only).
 */
export function actionErrorMessage(
  failure: Pick<ActionFailure, "code" | "reason">,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const { actionErrors, actionReasons } = getDictionary(locale).common;
  const reasons: Record<string, string | undefined> = actionReasons;
  return (failure.reason ? reasons[failure.reason] : undefined) ?? actionErrors[failure.code];
}
