import { signOutAction } from "@/features/auth/actions";
import { authErrorCodeSchema, type AuthErrorCode } from "@/domain/auth";
import {
  DEFAULT_LOCALE,
  getDictionary,
  isSupportedLocale,
  type SupportedLocale,
} from "@/domain/i18n";
import { Alert, Button } from "@/components/ui";

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
    <Alert tone="error" data-testid="login-error-alert" className="mb-5">
      <div className="flex flex-col gap-2">
        <span>{message}</span>
        {errorCode === "no_access" && (
          <form action={signOutAction} className="mt-1">
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
    </Alert>
  );
}

export function LoginNextInput({ next }: { next?: string | null }) {
  if (!next) return null;
  return <input type="hidden" name="next" value={next} />;
}
