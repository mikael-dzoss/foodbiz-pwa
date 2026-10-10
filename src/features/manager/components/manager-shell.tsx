import type { ReactNode } from "react";
import type { NavigationDictionary, QuickAddDictionary } from "@/domain/i18n";
import { ManagerBottomNav } from "./manager-bottom-nav";
import { ManagerSidebar } from "./manager-sidebar";

export interface ManagerShellProps {
  children: ReactNode;
  navDict: NavigationDictionary;
  quickAddDict: QuickAddDictionary;
}

export function ManagerShell({ children, navDict, quickAddDict }: ManagerShellProps) {
  return (
    <div className="bg-background text-foreground flex min-h-full flex-col">
      {/* Desktop Sidebar */}
      <ManagerSidebar navDict={navDict} quickAddDict={quickAddDict} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:pl-64">
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <ManagerBottomNav navDict={navDict} quickAddDict={quickAddDict} />
    </div>
  );
}
