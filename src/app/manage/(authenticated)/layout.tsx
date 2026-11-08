import type { ReactNode } from "react";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { ManagerShell } from "@/features/manager";
import { requireManagerSession } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";

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
      {children}
    </ManagerShell>
  );
}
