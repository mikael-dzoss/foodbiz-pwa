import type { Metadata } from "next";
import { APP_METADATA } from "@/config/app";
import { getServerEnv } from "@/config/env";
import {
  authErrorCodeSchema,
  sanitizeManagerRedirectPath,
  type AuthErrorCode,
} from "@/domain/auth";
import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "@/domain/i18n";
import { LoginView } from "@/features/auth/components/login-view";

export const metadata: Metadata = {
  title: `Manager Sign-in | ${APP_METADATA.name}`,
  description: "Sign in to access your FoodBiz manager dashboard and operations.",
};

export const instant = false;

export interface ManagerLoginPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  error?: string;
  locale?: SupportedLocale;
  next?: string;
}

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

  const locale: SupportedLocale =
    rawLocale && isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  const next = rawNext ? sanitizeManagerRedirectPath(rawNext) : undefined;

  const env = getServerEnv();
  const showDemoAccount = env.DATA_SOURCE === "mock" && env.NODE_ENV !== "production";

  return <LoginView error={error} locale={locale} next={next} showDemoAccount={showDemoAccount} />;
}
