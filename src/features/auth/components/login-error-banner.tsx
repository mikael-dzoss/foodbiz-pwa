import { AlertCircle } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import { authErrorCodeSchema, type AuthErrorCode } from "@/domain/auth";
import {
  DEFAULT_LOCALE,
  getDictionary,
  isSupportedLocale,
  type SupportedLocale,
} from "@/domain/i18n";
import { Button } from "@/components/ui/button";

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
          <Button
            variant="unstyled"
            size="none"
            type="submit"
            data-testid="login-error-signout-btn"
            className="text-primary hover:text-primary/80 focus-visible:ring-ring text-xs font-semibold underline underline-offset-2 transition-colors focus-visible:outline-none"
          >
            {dict.manager.signOut}
          </Button>
        </form>
      )}
    </div>
  );
}

export function LoginNextInput({ next }: { next?: string | null }) {
  if (!next) return null;
  return <input type="hidden" name="next" value={next} />;
}
