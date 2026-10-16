"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import type { StorefrontCatalogData } from "../catalog-data";
import { StoreStatusBanner } from "./store-status-banner";
import { CategoryTabs } from "./category-tabs";
import { ProductCatalogCard } from "./product-catalog-card";
import { StorefrontCartBar } from "./storefront-cart-bar";

export interface StorefrontCatalogViewProps {
  catalog: StorefrontCatalogData;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function StorefrontCatalogView({ catalog, locale, dict }: StorefrontCatalogViewProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter grouped categories and products based on selection & search query
  const filteredGroups = useMemo(() => {
    return catalog.groupedCategories
      .filter((group) => {
        if (selectedCategoryId === "all") return true;
        return group.id === selectedCategoryId;
      })
      .map((group) => {
        if (!normalizedQuery) return group;
        const matchingProducts = group.products.filter((p) => {
          return (
            p.name.toLowerCase().includes(normalizedQuery) ||
            p.description?.toLowerCase().includes(normalizedQuery)
          );
        });
        return {
          ...group,
          products: matchingProducts,
        };
      })
      .filter((group) => group.products.length > 0);
  }, [catalog.groupedCategories, selectedCategoryId, normalizedQuery]);

  const hasAnyProducts = filteredGroups.some((g) => g.products.length > 0);

  return (
    <div className="flex flex-col pb-24">
      {/* Live Store Status / Availability Banner (Story #82) */}
      <StoreStatusBanner
        isAcceptingOrders={catalog.isAcceptingOrders}
        isOpen={catalog.isOpen}
        orderTimingScheduled={catalog.settings?.orderTimingScheduled ?? true}
        openingHoursText={catalog.openingHoursText}
        dict={dict}
      />

      {/* Store Header Identity */}
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          {catalog.business.name}
        </h1>
        {catalog.business.description && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {catalog.business.description}
          </p>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mb-4 w-full">
        <Search className="text-muted-foreground absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={dict.searchPlaceholder}
          aria-label={dict.searchPlaceholder}
          className="border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:ring-ring h-11 w-full rounded-lg border pr-4 pl-10 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
        />
      </div>

      {/* Category Tabs */}
      {catalog.categories.length > 0 && (
        <div className="mb-6">
          <CategoryTabs
            categories={catalog.categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            allLabel={dict.allCategories}
          />
        </div>
      )}

      {/* Catalog Grouped by Category (Story #80 AC) */}
      {hasAnyProducts ? (
        <div className="flex flex-col gap-10">
          {filteredGroups.map((group) => (
            <section key={group.id} aria-labelledby={`category-heading-${group.id}`}>
              <div className="border-border mb-4 flex items-center justify-between border-b pb-2">
                <h2
                  id={`category-heading-${group.id}`}
                  className="text-foreground text-lg font-bold tracking-tight"
                >
                  {group.name}
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {group.products.length} {group.products.length === 1 ? dict.item : dict.items}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.products.map((product) => (
                  <ProductCatalogCard
                    key={product.id}
                    product={product}
                    categoryName={group.name}
                    locale={locale}
                    dict={dict}
                    lowStockThreshold={catalog.settings?.lowStockThreshold ?? 5}
                    disabled={!catalog.isAcceptingOrders}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="border-border bg-card my-8 flex flex-col items-center justify-center rounded-xl border p-8 text-center">
          <p className="text-foreground text-sm font-semibold">
            {searchQuery ? dict.noProductsFound : dict.noProductsInCategory}
          </p>
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      <StorefrontCartBar locale={locale} dict={dict} />
    </div>
  );
}
