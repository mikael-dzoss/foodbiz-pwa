"use client";

import Link from "next/link";
import { Folder, Receipt, Users, BarChart3, Settings, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SoonBadge } from "@/components/feedback";
import { signOutAction } from "@/features/auth/actions";

export interface MoreMenuSheetProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function MoreMenuSheet({ isOpen, onOpenChange, trigger }: MoreMenuSheetProps) {
  const menuItems = [
    {
      title: "Categories",
      href: "/manage/categories",
      icon: Folder,
      description: "Manage product categories",
      isReady: true,
    },
    {
      title: "Expenses",
      href: "/manage/expenses",
      icon: Receipt,
      description: "Log receipts and operating costs",
      isReady: true,
    },
    {
      title: "Customers",
      href: "/manage/customers",
      icon: Users,
      description: "Guest history and repeat diners",
      isReady: false,
    },
    {
      title: "Analytics",
      href: "/manage/analytics",
      icon: BarChart3,
      description: "Sales trends and performance",
      isReady: false,
    },
    {
      title: "Settings",
      href: "/manage/settings",
      icon: Settings,
      description: "Account and business profile",
      isReady: false,
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] max-w-md overflow-y-auto"
        data-testid="more-menu-sheet"
      >
        <SheetHeader className="mb-4">
          <SheetTitle>More Options</SheetTitle>
          <SheetDescription>Access management sections and settings</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            if (item.isReady) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange?.(false)}
                  className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-ring flex min-h-12 items-center gap-3 rounded-xl border p-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground text-sm font-medium">{item.title}</span>
                    <span className="text-body-sm text-muted-foreground truncate">
                      {item.description}
                    </span>
                  </div>
                </Link>
              );
            }

            return (
              <div
                key={item.href}
                className="border-border bg-muted/30 text-muted-foreground flex min-h-12 items-center gap-3 rounded-xl border p-3 opacity-80"
              >
                <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <SoonBadge />
                  </div>
                  <span className="text-body-sm text-muted-foreground/80 truncate">
                    {item.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sign out */}
        <div className="border-border mt-4 border-t pt-4">
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-destructive hover:bg-destructive/10 focus-visible:ring-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
