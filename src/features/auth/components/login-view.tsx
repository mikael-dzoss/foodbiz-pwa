import Link from "next/link";
import { ArrowLeft, Lock, Store } from "lucide-react";
import { signInMockAction, signInWithGoogleAction } from "@/features/auth/actions";
import { LoginErrorBanner, LoginNextInput } from "./login-error-banner";
import type { AuthErrorCode } from "@/domain/auth";
import { DEFAULT_LOCALE, getDictionary, type SupportedLocale } from "@/domain/i18n";
import { Button } from "@/components/ui/button";

export interface LoginViewProps {
  error?: AuthErrorCode | string | null;
  locale?: SupportedLocale;
  next?: string;
  showDemoAccount?: boolean;
}

export function LoginView({
  error,
  locale = DEFAULT_LOCALE,
  next,
  showDemoAccount = false,
}: LoginViewProps) {
  const dict = getDictionary(locale);

  return (
    <div className="bg-background text-foreground selection:bg-primary-soft selection:text-primary flex min-h-screen flex-col items-center justify-between antialiased">
      <h1 className="sr-only">{dict.login.pageHeading}</h1>

      {/* Mobile Screen Container (Strict mobile context matching Stitch A-01) */}
      <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-between px-4 pb-6">
        {/* Top Header Bar from Stitch A-01 Spec */}
        <header className="border-border mx-auto flex h-14 w-full max-w-sm items-center justify-between border-b px-2">
          <Link
            href="/"
            aria-label={dict.login.backToStorefront}
            className="text-primary hover:bg-muted -ml-2 inline-flex items-center justify-center rounded-lg p-2 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="text-primary text-lg font-bold tracking-tight">FoodBiz</div>
          <div className="w-9" />
        </header>

        {/* Main Content Canvas */}
        <div className="flex flex-1 flex-col justify-center py-6">
          {/* Brand Header */}
          <section className="mb-6 flex flex-col items-center text-center">
            {/* Emerald Emblem */}
            <div className="bg-primary-soft border-border/40 mb-3.5 flex h-12 w-12 items-center justify-center rounded-lg border shadow-none">
              <span className="text-primary text-2xl font-bold tracking-tighter">F</span>
            </div>
            {/* Brand Title & Subtitle Badge */}
            <h2 className="text-title-lg text-foreground">FoodBiz</h2>
            <div className="mt-1.5">
              <span className="text-primary-soft-foreground bg-primary-soft inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-normal">
                {dict.login.portalBadge}
              </span>
            </div>
          </section>

          {/* Main Login Surface Card */}
          <section className="bg-card border-border rounded-lg border p-6 shadow-none">
            {/* Accessible OAuth Error Banner */}
            <LoginErrorBanner error={error} locale={locale} />

            {/* Heading & Body */}
            <div className="mb-6">
              <h3 className="text-title-sm text-foreground">{dict.login.welcome}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-snug">{dict.login.intro}</p>
            </div>

            {/* Primary Action: Continue with Google */}
            <form action={signInWithGoogleAction}>
              <LoginNextInput next={next} />
              <Button
                variant="unstyled"
                size="none"
                id="google-sign-in-btn"
                type="submit"
                aria-label={dict.auth.continueWithGoogle}
                className="bg-card text-foreground border-border hover:bg-muted active:bg-muted/80 focus-visible:ring-ring flex h-12 w-full items-center justify-center gap-3 rounded-lg border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>{dict.auth.continueWithGoogle}</span>
              </Button>
            </form>

            {/* M5: Demo Account & Divider ONLY rendered when showDemoAccount is true */}
            {showDemoAccount && (
              <>
                {/* Divider with Text */}
                <div className="relative my-5 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="border-border w-full border-t" />
                  </div>
                  <span className="bg-card text-muted-foreground text-caption relative px-3 font-semibold tracking-wider uppercase">
                    {dict.login.developmentDivider}
                  </span>
                </div>

                {/* Secondary Action: Demo Account */}
                <form action={signInMockAction}>
                  <Button
                    variant="unstyled"
                    size="none"
                    id="sign-in-submit-btn"
                    type="submit"
                    data-testid="btn-demo-sign-in"
                    aria-label={dict.login.demoSignIn}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-opacity focus-visible:ring-2 focus-visible:outline-none active:opacity-90"
                  >
                    <Store className="h-4.5 w-4.5" />
                    <span>{dict.login.demoSignIn}</span>
                  </Button>
                </form>
              </>
            )}

            {/* Helper Note & Compliance */}
            <div className="border-border mt-5 flex items-center justify-center gap-1.5 border-t pt-4 text-center">
              <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
              <p className="text-muted-foreground text-xs leading-snug">{dict.login.restricted}</p>
            </div>
          </section>

          {/* Quick Operations Diagnostic / Status from Stitch Spec */}
          {/* TODO(ops): Wire system status and latency indicator to health check endpoint (#97, #100) */}
          <div className="text-muted-foreground mt-4 flex items-center justify-between px-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="bg-primary inline-block h-2 w-2 rounded-full" />
              <span className="font-medium">{dict.login.systemOnline}</span>
            </div>
            <div className="font-medium tabular-nums">{dict.login.latency}</div>
          </div>
        </div>

        {/* Bottom Metadata & Legal from Stitch Spec */}
        <footer className="pt-2 pb-2 text-center">
          <p className="text-muted-foreground text-caption tracking-normal tabular-nums">
            {dict.login.footer}
          </p>
        </footer>
      </main>
    </div>
  );
}
