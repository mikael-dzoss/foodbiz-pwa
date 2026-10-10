"use client";

import Link from "next/link";
import { ShoppingBag, Receipt, PackagePlus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { QuickAddDictionary } from "@/domain/i18n";

export interface QuickAddSheetProps {
  dict: QuickAddDictionary;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function QuickAddSheet({ dict, isOpen, onOpenChange, trigger }: QuickAddSheetProps) {
  const quickActions = [
    {
      title: dict.newOrder,
      href: "/manage/orders/new",
      icon: ShoppingBag,
      description: "Take customer order manually",
    },
    {
      title: dict.newProduct,
      href: "/manage/products/new",
      icon: PackagePlus,
      description: "Add food or beverage item",
    },
    {
      title: dict.newExpense,
      href: "/manage/expenses/new",
      icon: Receipt,
      description: "Log receipt or purchase",
    },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent side="bottom" className="mx-auto max-w-md" data-testid="quick-add-sheet">
        <SheetHeader className="mb-4">
          <SheetTitle>{dict.title}</SheetTitle>
          <SheetDescription>{dict.description}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => onOpenChange?.(false)}
                className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-ring flex min-h-12 items-center gap-4 rounded-xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="bg-primary-soft text-primary-soft-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-foreground font-medium">{action.title}</span>
                  <span className="text-body-sm text-muted-foreground">{action.description}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
