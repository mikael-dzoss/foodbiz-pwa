"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Plus, Package, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavigationDictionary, QuickAddDictionary } from "@/domain/i18n";
import { QuickAddSheet } from "./quick-add-sheet";
import { MoreMenuSheet } from "./more-menu-sheet";
import { useState } from "react";

export interface ManagerBottomNavProps {
  navDict: NavigationDictionary;
  quickAddDict: QuickAddDictionary;
}

export function ManagerBottomNav({ navDict, quickAddDict }: ManagerBottomNavProps) {
  const pathname = usePathname();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (route: string) => {
    if (route === "/manage") {
      return pathname === "/manage";
    }
    return pathname.startsWith(route);
  };

  return (
    <nav
      aria-label="Manager mobile navigation"
      className="border-border bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="flex h-16 items-center justify-around px-2">
        {/* Dashboard */}
        <Link
          href="/manage"
          aria-current={isActive("/manage") ? "page" : undefined}
          className={cn(
            "flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors",
            isActive("/manage")
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              isActive("/manage") && "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <span>{navDict.dashboard}</span>
        </Link>

        {/* Orders */}
        <Link
          href="/manage/orders"
          aria-current={isActive("/manage/orders") ? "page" : undefined}
          className={cn(
            "flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors",
            isActive("/manage/orders")
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              isActive("/manage/orders") && "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            <ShoppingBag className="h-5 w-5" />
          </div>
          <span>{navDict.orders}</span>
        </Link>

        {/* Quick Add (Center Primary Action) */}
        <QuickAddSheet
          dict={quickAddDict}
          isOpen={quickAddOpen}
          onOpenChange={setQuickAddOpen}
          trigger={
            <button
              type="button"
              aria-label={navDict.add}
              className="group -mt-4 flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 text-xs focus-visible:outline-none"
            >
              <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-transform group-hover:opacity-90 active:scale-95">
                <Plus className="h-6 w-6 stroke-[2.5]" />
              </div>
              <span className="text-muted-foreground group-hover:text-foreground">
                {navDict.add}
              </span>
            </button>
          }
        />

        {/* Products */}
        <Link
          href="/manage/products"
          aria-current={isActive("/manage/products") ? "page" : undefined}
          className={cn(
            "flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors",
            isActive("/manage/products")
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <div
            className={cn(
              "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
              isActive("/manage/products") && "bg-primary-soft text-primary-soft-foreground",
            )}
          >
            <Package className="h-5 w-5" />
          </div>
          <span>{navDict.products}</span>
        </Link>

        {/* More */}
        <MoreMenuSheet
          isOpen={moreOpen}
          onOpenChange={setMoreOpen}
          trigger={
            <button
              type="button"
              aria-label={navDict.more}
              className={cn(
                "flex min-h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors",
                moreOpen
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  moreOpen && "bg-primary-soft text-primary-soft-foreground",
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
              </div>
              <span>{navDict.more}</span>
            </button>
          }
        />
      </div>
    </nav>
  );
}
