import type { ReactNode } from "react";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { ManagerShell } from "@/features/manager";

export interface ManageLayoutProps {
  children: ReactNode;
}

export default function ManageLayout({ children }: ManageLayoutProps) {
  // Manager locale defaults to EN or from user preference
  const dict = getDictionary(DEFAULT_LOCALE);

  return (
    <ManagerShell navDict={dict.nav} quickAddDict={dict.quickAdd}>
      {children}
    </ManagerShell>
  );
}
