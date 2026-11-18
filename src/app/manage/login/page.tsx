import type { Metadata } from "next";
import { getServerEnv } from "@/config/env";
import {
  authErrorCodeSchema,
  sanitizeManagerRedirectPath,
  type AuthErrorCode,
} from "@/domain/auth";
import { isSupportedLocale, type SupportedLocale } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { LoginView } from "@/features/auth/components/login-view";

export const metadata: Metadata = {
  title: "Manager Sign-in",
  description: "Sign in to access your FoodBiz manager dashboard and operations.",
};

export interface ManagerLoginPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  error?: string;
  locale?: SupportedLocale;
  next?: string;
}

// The page renders from searchParams (error/locale) and redirects signed-in managers, so it blocks.
export const instant = false;

export default async function ManagerLoginPage(props: ManagerLoginPageProps = {}) {
  const resolvedParams = props.searchParams ? await props.searchParams : {};
  const rawError = typeof resolvedParams.error === "string" ? resolvedParams.error : props.error;
  const rawLocale =
    typeof resolvedParams.locale === "string" ? resolvedParams.locale : props.locale;
  const rawNext = typeof resolvedParams.next === "string" ? resolvedParams.next : props.next;

  const parsedError = rawError ? authErrorCodeSchema.safeParse(rawError) : null;
  const error: AuthErrorCode | undefined = rawError
    ? parsedError?.success
      ? parsedError.data
      : "auth_failed"
    : undefined;

  // An explicit ?locale wins (OAuth round-trip), otherwise the manager's saved language.
  const locale: SupportedLocale =
    rawLocale && isSupportedLocale(rawLocale) ? rawLocale : await getManagerLocale();

  const next = rawNext ? sanitizeManagerRedirectPath(rawNext) : undefined;

  const env = getServerEnv();
  const showDemoAccount = env.DATA_SOURCE === "mock" && env.NODE_ENV !== "production";

  return <LoginView error={error} locale={locale} next={next} showDemoAccount={showDemoAccount} />;
}
