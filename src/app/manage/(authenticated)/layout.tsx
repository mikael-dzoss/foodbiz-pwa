import type { ReactNode } from "react";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { DEFAULT_TIMEZONE } from "@/domain/timezone";
import { BusinessTimeZoneProvider } from "@/components/time/business-timezone";
import { ManagerShell } from "@/features/manager";
import { requireManagerSession } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";

// The session check must resolve before the shell (and its business settings) can render.
export const instant = false;

export interface AuthenticatedManageLayoutProps {
  children: ReactNode;
}

export default async function AuthenticatedManageLayout({
  children,
}: AuthenticatedManageLayoutProps) {
  // Defense-in-depth: re-check session server-side
  const session = await requireManagerSession();
  const repos = getRepositories();
  const settings = await repos.business.getSettings(session.user.businessId);
  const soundAlertsEnabled = settings?.soundAlerts ?? true;

  const dict = getDictionary(DEFAULT_LOCALE);

  return (
    <ManagerShell
      navDict={dict.nav}
      quickAddDict={dict.quickAdd}
      soundAlertsEnabled={soundAlertsEnabled}
      businessId={session.user.businessId}
    >
      <BusinessTimeZoneProvider timeZone={settings?.timezone ?? DEFAULT_TIMEZONE}>
        {children}
      </BusinessTimeZoneProvider>
    </ManagerShell>
  );
}
