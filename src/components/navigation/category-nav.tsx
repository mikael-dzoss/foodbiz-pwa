"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, List } from "lucide-react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "./use-scroll-spy";

export interface CategoryNavItem {
  id: string;
  label: string;
}

export interface CategoryNavProps {
  items: readonly CategoryNavItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  menuTitle: string;
  menuSubtitle?: string | null;
  menuLabel: string;
  dismissLabel: string;
  trailing?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function CategoryNav({
  items,
  activeId,
  onSelect,
  menuTitle,
  menuSubtitle,
  menuLabel,
  dismissLabel,
  trailing,
  className,
  "data-testid": testId = "category-nav",
}: CategoryNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const closedBySelectRef = useRef(false);

  useEffect(() => {
    if (!activeId) return;
    const activeTab = tabRefs.current.get(activeId);
    if (!activeTab || typeof activeTab.scrollIntoView !== "function") return;

    activeTab.scrollIntoView({
      behavior: prefersReducedMotion() ? "instant" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeId]);

  const handleSheetSelect = (id: string) => {
    closedBySelectRef.current = true;
    setSheetOpen(false);
    const stopFocusTrap = (event: FocusEvent) => {
      event.stopImmediatePropagation();
    };
    document.addEventListener("focusin", stopFocusTrap, true);
    document.addEventListener("focusout", stopFocusTrap, true);
    try {
      onSelect(id);
    } finally {
      document.removeEventListener("focusin", stopFocusTrap, true);
      document.removeEventListener("focusout", stopFocusTrap, true);
    }
  };

  return (
    <div
      data-testid={testId}
      className={cn(
        "border-border bg-card/95 flex items-center gap-2 border-b px-4 py-1.5 backdrop-blur-md",
        className,
      )}
    >
      <Button
        variant="unstyled"
        size="none"
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={menuLabel}
        aria-expanded={sheetOpen}
        aria-haspopup="dialog"
        data-testid="category-nav-menu-button"
        className="border-border bg-muted/50 text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-hidden active:scale-95 motion-reduce:transform-none"
      >
        <List className="h-5 w-5" aria-hidden="true" />
      </Button>

      <nav
        aria-label={menuLabel}
        className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <Button
              variant="unstyled"
              size="none"
              key={item.id}
              ref={(node) => {
                if (node) {
                  tabRefs.current.set(item.id, node);
                } else {
                  tabRefs.current.delete(item.id);
                }
              }}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "true" : undefined}
              data-testid={`category-nav-tab-${item.id}`}
              className={cn(
                "focus-visible:ring-ring inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-hidden active:opacity-80",
                isActive
                  ? "border-primary text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground border-transparent font-medium",
              )}
            >
              {item.label}
            </Button>
          );
        })}
      </nav>

      {trailing && <div className="shrink-0">{trailing}</div>}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          data-testid="category-nav-sheet"
          onCloseAutoFocus={(event) => {
            if (closedBySelectRef.current) {
              event.preventDefault();
              closedBySelectRef.current = false;
            }
          }}
        >
          <SheetHeader className="border-border/60 border-b pb-3">
            <SheetTitle>{menuTitle}</SheetTitle>
            {menuSubtitle ? (
              <SheetDescription className="tabular-nums">{menuSubtitle}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{menuLabel}</SheetDescription>
            )}
          </SheetHeader>

          <nav aria-label={menuTitle} className="divide-border/50 mt-3 flex flex-col divide-y">
            {items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <Button
                  variant="unstyled"
                  size="none"
                  key={item.id}
                  type="button"
                  onClick={() => handleSheetSelect(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  data-testid={`category-nav-sheet-item-${item.id}`}
                  className={cn(
                    "focus-visible:ring-ring flex min-h-12 w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden active:opacity-80",
                    isActive
                      ? "bg-primary-soft text-primary-soft-foreground font-bold"
                      : "text-foreground hover:bg-muted font-normal",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="bg-primary h-4 w-1.5 shrink-0 rounded-full"
                      />
                    )}
                    <span>{item.label}</span>
                  </span>
                  {isActive ? (
                    <Check aria-hidden="true" className="text-primary h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight
                      aria-hidden="true"
                      className="text-muted-foreground h-4 w-4 shrink-0"
                    />
                  )}
                </Button>
              );
            })}
          </nav>

          <SheetFooter>
            <Button
              type="button"
              variant="default"
              className="w-full"
              data-testid="category-nav-sheet-dismiss"
              onClick={() => setSheetOpen(false)}
            >
              {dismissLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
