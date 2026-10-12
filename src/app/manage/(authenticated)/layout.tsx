import type { ReactNode } from "react";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { ManagerShell } from "@/features/manager";
import { requireManagerSession } from "@/lib/auth";

export const instant = false;

export interface AuthenticatedManageLayoutProps {
  children: ReactNode;
}

export default async function AuthenticatedManageLayout({
  children,
}: AuthenticatedManageLayoutProps) {
  // Defense-in-depth: re-check session server-side
  await requireManagerSession();

  const dict = getDictionary(DEFAULT_LOCALE);

  return (
    <ManagerShell navDict={dict.nav} quickAddDict={dict.quickAdd}>
      {children}
    </ManagerShell>
  );
}
