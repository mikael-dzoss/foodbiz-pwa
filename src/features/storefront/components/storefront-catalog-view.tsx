"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
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
      .map((group) => {
        if (selectedCategoryId !== "all" && group.id !== selectedCategoryId) {
          return null;
        }
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
      .filter((group): group is (typeof catalog.groupedCategories)[number] => {
        return group !== null && group.products.length > 0;
      });
  }, [catalog, selectedCategoryId, normalizedQuery]);

  const hasAnyProducts = filteredGroups.some((g) => g.products.length > 0);

  return (
    <div className="flex flex-col pb-6">
      {/* Semantic Accessible Heading for SEO & Screen Readers (Brand shown in TopAppBar per Stitch) */}
      <h1 className="sr-only">{catalog.business.name}</h1>

      {/* Live Store Status / Availability Banner (Stitch C-01) */}
      <StoreStatusBanner
        isAcceptingOrders={catalog.isAcceptingOrders}
        isOpen={catalog.isOpen}
        orderTimingScheduled={catalog.settings?.orderTimingScheduled ?? true}
        openingHoursText={catalog.openingHoursText}
        dict={dict}
      />

      {/* Sticky Search & Category Filter Section (Stitch C-01) */}
      <section className="bg-background/95 border-border/40 sticky top-14 z-30 -mx-4 mb-4 flex flex-col gap-2 border-b px-4 py-2 backdrop-blur-xs sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        {/* Search Input */}
        <div className="relative flex w-full items-center">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={dict.searchPlaceholder}
            aria-label={dict.searchPlaceholder}
            className="border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-primary h-9.5 w-full rounded-lg border pr-3 pl-9 text-sm transition-colors focus:outline-hidden"
          />
        </div>

        {/* Category Tabs */}
        {catalog.categories.length > 0 && (
          <CategoryTabs
            categories={catalog.categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            allLabel={dict.allCategories}
          />
        )}
      </section>

      {/* Catalog Grouped by Category (Stitch C-01) */}
      {hasAnyProducts ? (
        <div className="flex flex-col gap-6">
          {filteredGroups.map((group, groupIdx) => (
            <section key={group.id} aria-labelledby={`category-heading-${group.id}`}>
              <div className="border-border/60 mb-3 flex items-center justify-between border-b pb-1.5">
                <h2
                  id={`category-heading-${group.id}`}
                  className="text-foreground text-sm font-bold tracking-tight"
                >
                  {group.name}
                </h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {group.products.length} {group.products.length === 1 ? dict.item : dict.items}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.products.map((product, productIdx) => (
                  <ProductCatalogCard
                    key={product.id}
                    product={product}
                    categoryName={group.name}
                    locale={locale}
                    dict={dict}
                    lowStockThreshold={catalog.settings?.lowStockThreshold ?? 5}
                    disabled={!catalog.isAcceptingOrders}
                    priority={groupIdx === 0 && productIdx < 2}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Store Hours & Bakery Info Box (Stitch C-01) */}
          <Link
            href={`/${locale}/info`}
            className="border-border/60 bg-muted/40 hover:bg-muted/70 text-muted-foreground mt-2 flex items-center justify-between rounded-lg border p-3 text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary h-4 w-4 shrink-0" />
              <span>100% Organic Flours &amp; Artisanal Baking</span>
            </div>
            <span className="text-primary flex shrink-0 items-center gap-1 text-[11px] font-semibold">
              {dict.bakeryInfo ?? "Bakery Info"} →
            </span>
          </Link>
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
