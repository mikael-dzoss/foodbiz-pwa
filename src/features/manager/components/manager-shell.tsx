import type { ReactNode } from "react";
import type { NavigationDictionary, QuickAddDictionary } from "@/domain/i18n";
import { OrderAlertsProvider } from "@/features/orders";
import { ManagerBottomNav } from "./manager-bottom-nav";
import { ManagerSidebar } from "./manager-sidebar";

export interface ManagerShellProps {
  children: ReactNode;
  navDict: NavigationDictionary;
  quickAddDict: QuickAddDictionary;
  soundAlertsEnabled?: boolean;
  businessId?: string;
}

export function ManagerShell({
  children,
  navDict,
  quickAddDict,
  soundAlertsEnabled = true,
  businessId,
}: ManagerShellProps) {
  return (
    <OrderAlertsProvider initialSoundAlerts={soundAlertsEnabled} businessId={businessId}>
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
    </OrderAlertsProvider>
  );
}
