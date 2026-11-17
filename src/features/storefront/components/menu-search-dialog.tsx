"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui";
import { searchMenuProducts } from "@/domain/product";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import type { GroupedCategory } from "../catalog-data";
import { ProductCatalogCard } from "./product-catalog-card";
import { StorefrontCartBar } from "./storefront-cart-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MenuSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseRestoreFocus?: () => void;
  groupedCategories: readonly GroupedCategory[];
  businessName: string;
  lowStockThreshold?: number;
  isAcceptingOrders: boolean;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function MenuSearchDialog({
  open,
  onOpenChange,
  onCloseRestoreFocus,
  groupedCategories,
  businessName,
  lowStockThreshold = 5,
  isAcceptingOrders,
  locale,
  dict,
}: MenuSearchDialogProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const results = useMemo(
    () => searchMenuProducts(groupedCategories, query),
    [groupedCategories, query],
  );

  const restoreFocusWithoutTrap = () => {
    if (!onCloseRestoreFocus) return;
    const stopFocusTrap = (event: FocusEvent) => {
      event.stopImmediatePropagation();
    };
    document.addEventListener("focusin", stopFocusTrap, true);
    document.addEventListener("focusout", stopFocusTrap, true);
    try {
      onCloseRestoreFocus();
    } finally {
      document.removeEventListener("focusin", stopFocusTrap, true);
      document.removeEventListener("focusout", stopFocusTrap, true);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
    }
    onOpenChange(nextOpen);
    if (!nextOpen) {
      restoreFocusWithoutTrap();
    }
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        data-testid="menu-search-dialog"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (onCloseRestoreFocus) {
            event.preventDefault();
            restoreFocusWithoutTrap();
          }
        }}
        className="bg-background inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{dict.searchMenu}</DialogTitle>
        <DialogDescription className="sr-only">{dict.searchInitialHint}</DialogDescription>

        {/* Sticky Search Header (Stitch C-01d) */}
        <header className="border-border bg-card pt-safe-min-3 sticky top-0 z-10 border-b px-4 pb-3">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="unstyled"
                size="none"
                type="button"
                onClick={() => handleOpenChange(false)}
                aria-label={dict.closeSearch}
                data-testid="menu-search-back-button"
                className="text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-hidden active:scale-95 motion-reduce:transform-none"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Button>

              <div className="border-input bg-muted/40 focus-within:border-primary focus-within:ring-ring relative flex min-h-11 flex-1 items-center rounded-full border pr-2 pl-3.5 transition-colors focus-within:ring-2">
                <Search
                  className="text-muted-foreground mr-2 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <Input
                  ref={inputRef}
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={dict.searchPlaceholder}
                  aria-label={dict.searchMenu}
                  data-testid="menu-search-input"
                  className="text-foreground placeholder:text-muted-foreground h-11 min-h-0 w-full rounded-none border-0 bg-transparent px-0 py-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:hidden"
                />
                {query.length > 0 && (
                  <Button
                    variant="unstyled"
                    size="none"
                    type="button"
                    onClick={handleClear}
                    aria-label={dict.clearSearch}
                    data-testid="menu-search-clear-button"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mr-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-hidden active:scale-95 motion-reduce:transform-none"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            {hasQuery && results.length > 0 && (
              <div className="flex items-center justify-between px-1 pt-1">
                <p
                  data-testid="menu-search-results-count"
                  aria-live="polite"
                  className="text-muted-foreground text-xs font-medium tabular-nums"
                >
                  {results.length}{" "}
                  {results.length === 1 ? dict.searchResultSingular : dict.searchResultPlural}
                </p>
                <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
                  {businessName}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Search Results Body */}
        <div className="pb-safe-min-6 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {!hasQuery ? (
              <div
                data-testid="menu-search-initial-hint"
                className="border-border bg-card my-8 flex flex-col items-center justify-center rounded-xl border p-8 text-center"
              >
                <Search className="text-muted-foreground mb-2 h-6 w-6" aria-hidden="true" />
                <p className="text-muted-foreground text-sm">{dict.searchInitialHint}</p>
              </div>
            ) : results.length === 0 ? (
              <div
                data-testid="menu-search-empty-state"
                role="status"
                className="border-border bg-card my-8 flex flex-col items-center justify-center rounded-xl border p-8 text-center"
              >
                <p className="text-foreground text-sm font-semibold">
                  {dict.searchNoResultsFor.replace("{query}", trimmedQuery)}
                </p>
              </div>
            ) : (
              <div
                data-testid="menu-search-results"
                className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0 sm:border-0 sm:bg-transparent lg:grid-cols-3"
              >
                {results.map(({ product, categoryName }) => (
                  <ProductCatalogCard
                    key={product.id}
                    product={product}
                    categoryName={categoryName}
                    locale={locale}
                    dict={dict}
                    lowStockThreshold={lowStockThreshold}
                    disabled={!isAcceptingOrders}
                  />
                ))}
              </div>
            )}

            {/* Recommendation: Related category quick-filter pills from Stitch C-01d can be wired here to prefill category searches */}
            <StorefrontCartBar locale={locale} dict={dict} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
