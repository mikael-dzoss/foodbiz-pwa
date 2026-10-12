"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Receipt,
  Users,
  BarChart3,
  Settings,
  Plus,
  LogOut,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavigationDictionary, QuickAddDictionary } from "@/domain/i18n";
import { APP_METADATA } from "@/config/app";
import { signOutAction } from "@/features/auth/actions";
import { QuickAddSheet } from "./quick-add-sheet";
import { useState } from "react";

export interface ManagerSidebarProps {
  navDict: NavigationDictionary;
  quickAddDict: QuickAddDictionary;
}

export function ManagerSidebar({ navDict, quickAddDict }: ManagerSidebarProps) {
  const pathname = usePathname();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const isActive = (route: string) => {
    if (route === "/manage") {
      return pathname === "/manage";
    }
    return pathname.startsWith(route);
  };

  const navItems = [
    { href: "/manage", label: navDict.dashboard, icon: LayoutDashboard },
    { href: "/manage/orders", label: navDict.orders, icon: ShoppingBag },
    { href: "/manage/products", label: navDict.products, icon: Package },
    { href: "/manage/categories", label: "Categories", icon: Folder },
    { href: "/manage/expenses", label: navDict.expenses, icon: Receipt },
    { href: "/manage/customers", label: navDict.customers, icon: Users },
    { href: "/manage/analytics", label: navDict.analytics, icon: BarChart3 },
    { href: "/manage/settings", label: navDict.settings, icon: Settings },
  ];

  return (
    <aside
      aria-label="Manager desktop sidebar"
      className="border-border bg-card hidden border-r p-4 md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col"
    >
      {/* Brand */}
      <div className="mb-4 flex items-center gap-3 px-2 py-3">
        <div className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-lg font-semibold">
          F
        </div>
        <div className="flex flex-col">
          <span className="text-foreground text-sm leading-tight font-semibold">
            {APP_METADATA.name}
          </span>
          <span className="text-muted-foreground text-xs">Manager</span>
        </div>
      </div>

      {/* Quick Add CTA */}
      <div className="mb-6">
        <QuickAddSheet
          dict={quickAddDict}
          isOpen={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          trigger={
            <button
              type="button"
              className="bg-primary text-primary-foreground focus-visible:ring-ring flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-xs transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:outline-none"
            >
              <Plus className="h-4 w-4" />
              <span>{navDict.add}</span>
            </button>
          }
        />
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-border mt-auto border-t pt-4">
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
