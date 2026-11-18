import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_METADATA } from "@/config/app";
import { HtmlLangSync, ManagerLocaleProvider } from "@/components/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

// The manager language comes from a cookie, so the area renders per request (it is auth-gated anyway).
export const instant = false;

export interface ManageRootLayoutProps {
  children: ReactNode;
}

// Pages set a bare title ("Orders"); the template appends the app name exactly once.
export const metadata: Metadata = {
  title: { default: APP_METADATA.name, template: `%s · ${APP_METADATA.name}` },
  robots: { index: false, follow: false },
};

export default async function ManageRootLayout({ children }: ManageRootLayoutProps) {
  const locale = await getManagerLocale();
  return (
    // key: the provider's value never changes after first render; a language switch remounts.
    <ManagerLocaleProvider key={locale} locale={locale}>
      <HtmlLangSync locale={locale} />
      {children}
    </ManagerLocaleProvider>
  );
}
