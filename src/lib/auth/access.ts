import "server-only";

import { getServerEnv } from "@/config/env";

export interface EnvironmentOptions {
  nodeEnv?: string;
  appEnv?: string;
}

export interface AllowedEmailOptions extends EnvironmentOptions {
  allowedEmailsRaw?: string;
}

/**
 * Splits a comma-separated list of emails, trimming whitespace, lowercasing,
 * and filtering out empty strings.
 */
export function parseAllowedManagerEmails(raw?: string | null): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Returns true if both nodeEnv and appEnv resolve to "development" or "test".
 * Strictly returns false in "production" or "staging".
 */
export function isDevOrTestEnvironment(options?: EnvironmentOptions): boolean {
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const appEnv = options?.appEnv ?? process.env.APP_ENV ?? nodeEnv;

  if (nodeEnv === "production" || appEnv === "production" || appEnv === "staging") {
    return false;
  }

  return (
    (nodeEnv === "development" || nodeEnv === "test") &&
    (appEnv === "development" || appEnv === "test")
  );
}

/**
 * Checks whether an email is included in the allowed manager email list.
 * Only honoured in development or test environments; unconditionally returns false in production or staging.
 */
export function isEmailInAllowedManagerList(
  email: string | null | undefined,
  options?: AllowedEmailOptions,
): boolean {
  if (!email || !isDevOrTestEnvironment(options)) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const rawList =
    options?.allowedEmailsRaw !== undefined
      ? options.allowedEmailsRaw
      : getServerEnv().ALLOWED_MANAGER_EMAILS;

  const allowedList = parseAllowedManagerEmails(rawList);
  return allowedList.includes(normalizedEmail);
}
