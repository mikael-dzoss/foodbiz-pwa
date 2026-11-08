import { AlertCircle } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import { authErrorCodeSchema, type AuthErrorCode } from "@/domain/auth";
import {
  DEFAULT_LOCALE,
  getDictionary,
  isSupportedLocale,
  type SupportedLocale,
} from "@/domain/i18n";
import { signOutAction } from "../actions";

export interface LoginErrorBannerProps {
  error?: AuthErrorCode | string | null;
  locale?: SupportedLocale | string | null;
}

export function LoginErrorBanner({ error, locale }: LoginErrorBannerProps) {
  if (!error) {
    return null;
  }

  const parsed = authErrorCodeSchema.safeParse(error);
  const errorCode: AuthErrorCode = parsed.success ? parsed.data : "auth_failed";

  const activeLocale: SupportedLocale =
    locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  const dict = getDictionary(activeLocale);
  const message = dict.auth.errors[errorCode] ?? dict.auth.errors.auth_failed;

  if (errorCode === "no_access") {
    return (
      <div
        role="alert"
        data-testid="login-error-alert"
        className="bg-destructive/10 text-destructive border-destructive/20 mb-5 flex flex-col gap-3 rounded-lg border p-3.5 text-xs font-medium"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <h4 className="text-destructive leading-tight font-semibold">
              {dict.auth.noAccessTitle}
            </h4>
            <p className="text-destructive/90 leading-snug">{message}</p>
          </div>
        </div>
        <form action={signOutAction} className="mt-0.5 flex justify-end">
          <button
            type="submit"
            id="sign-out-switch-btn"
            className="bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span>{dict.auth.signOutAndSwitch}</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div
      role="alert"
      data-testid="login-error-alert"
      className="bg-destructive/10 text-destructive border-destructive/20 mb-5 flex flex-col gap-2 rounded-lg border p-3 text-xs leading-snug font-medium"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {errorCode === "no_access" && (
        <form action={signOutAction} className="mt-1 pl-6.5">
          <button
            type="submit"
            data-testid="login-error-signout-btn"
            className="text-primary hover:text-primary/80 focus-visible:ring-ring text-xs font-semibold underline underline-offset-2 transition-colors focus-visible:outline-none"
          >
            {activeLocale === "fr" ? "Se déconnecter" : "Sign out"}
          </button>
        </form>
      )}
    </div>
  );
}

export function LoginNextInput({ next }: { next?: string | null }) {
  if (!next) return null;
  return <input type="hidden" name="next" value={next} />;
}
