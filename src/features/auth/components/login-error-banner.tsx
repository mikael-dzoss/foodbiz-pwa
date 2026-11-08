"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { authErrorCodeSchema, type AuthErrorCode } from "@/domain/auth";
import {
  DEFAULT_LOCALE,
  getDictionary,
  isSupportedLocale,
  type SupportedLocale,
} from "@/domain/i18n";

export interface LoginErrorBannerProps {
  error?: string | null;
  locale?: SupportedLocale | string | null;
}

function LoginErrorBannerInner({ error: propError, locale: propLocale }: LoginErrorBannerProps) {
  let searchParams: URLSearchParams | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch {
    // Gracefully handle contexts outside Next navigation router
  }

  const searchParamError = searchParams?.get("error");
  const rawError = propError ?? searchParamError;

  const searchParamLocale = searchParams?.get("locale");
  const rawLocale = propLocale ?? searchParamLocale;
  const activeLocale: SupportedLocale =
    rawLocale && isSupportedLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  if (!rawError) {
    return null;
  }

  const parsed = authErrorCodeSchema.safeParse(rawError);
  const errorCode: AuthErrorCode = parsed.success ? parsed.data : "auth_failed";

  const dict = getDictionary(activeLocale);
  const message = dict.auth.errors[errorCode] ?? dict.auth.errors.auth_failed;

  return (
    <div
      role="alert"
      data-testid="login-error-alert"
      className="bg-destructive/10 text-destructive border-destructive/20 mb-5 flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-snug font-medium"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function LoginErrorBanner(props: LoginErrorBannerProps) {
  return (
    <Suspense fallback={null}>
      <LoginErrorBannerInner {...props} />
    </Suspense>
  );
}

function LoginNextInputInner({ next: propNext }: { next?: string | null }) {
  let searchParams: URLSearchParams | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    searchParams = useSearchParams();
  } catch {
    // Gracefully handle contexts outside Next navigation router
  }

  const nextValue = propNext ?? searchParams?.get("next");
  if (!nextValue) return null;
  return <input type="hidden" name="next" value={nextValue} />;
}

export function LoginNextInput({ next }: { next?: string | null }) {
  return (
    <Suspense fallback={null}>
      <LoginNextInputInner next={next} />
    </Suspense>
  );
}
