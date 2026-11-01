"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import {
  CategoryNav,
  prefersReducedMotion,
  useScrollPastSentinel,
  useScrollSpy,
} from "@/components/navigation";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import type { StorefrontCatalogData } from "../catalog-data";
import { ServiceToggleHeader } from "./service-toggle-header";
import { ProductCatalogCard } from "./product-catalog-card";
import { StorefrontCartBar } from "./storefront-cart-bar";

export interface StorefrontCatalogViewProps {
  catalog: StorefrontCatalogData;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function StorefrontCatalogView({ catalog, locale, dict }: StorefrontCatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter grouped categories and products based on search query
  const filteredGroups = useMemo(() => {
    return catalog.groupedCategories
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
      .filter((group): group is (typeof catalog.groupedCategories)[number] => {
        return group.products.length > 0;
      });
  }, [catalog, normalizedQuery]);

  const hasAnyProducts = filteredGroups.some((g) => g.products.length > 0);
  const sectionIds = useMemo(() => filteredGroups.map((g) => g.id), [filteredGroups]);
  const navItems = useMemo(
    () => filteredGroups.map((g) => ({ id: g.id, label: g.name })),
    [filteredGroups],
  );

  const { activeId, setActiveId } = useScrollSpy(sectionIds);
  const { sentinelRef, isPast } = useScrollPastSentinel(hasAnyProducts);

  const handleSelectCategory = (categoryId: string) => {
    setActiveId(categoryId);
    const heading = document.getElementById(`category-heading-${categoryId}`);
    if (!heading) return;

    if (typeof heading.scrollIntoView === "function") {
      heading.scrollIntoView({
        behavior: prefersReducedMotion() ? "instant" : "smooth",
        block: "start",
      });
    }
    heading.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col pb-6">
      {/* Semantic Accessible Heading for SEO & Screen Readers (Brand shown in TopAppBar per Stitch) */}
      <h1 className="sr-only">{catalog.business.name}</h1>

      {/* Sticky Category Bar (Stitch C-01b): shown only once first category title has scrolled past */}
      {isPast && navItems.length > 0 && (
        <div data-testid="sticky-category-nav" className="sticky top-14 z-30 -mx-4 -mb-14 sm:mx-0">
          <CategoryNav
            items={navItems}
            activeId={activeId}
            onSelect={handleSelectCategory}
            menuTitle={dict.menu}
            menuSubtitle={catalog.openingHoursText}
            menuLabel={dict.browseCategories}
            dismissLabel={dict.dismiss}
          />
        </div>
      )}

      {/* Live Store Status & Service Mode Toggle Header (Stitch C-01) */}
      <ServiceToggleHeader
        isAcceptingOrders={catalog.isAcceptingOrders}
        isOpen={catalog.isOpen}
        orderTimingScheduled={catalog.settings?.orderTimingScheduled ?? true}
        openingHoursText={catalog.openingHoursText}
        businessAddress={catalog.business.address}
        settings={catalog.settings}
        locale={locale}
        dict={dict}
      />

      {/* Non-sticky Search Input (replaced by search launcher in #203) */}
      <div className="mb-4 flex w-full items-center">
        <div className="relative flex w-full items-center">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={dict.searchPlaceholder}
            aria-label={dict.searchPlaceholder}
            data-testid="catalog-search-input"
            className="border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-primary h-11 w-full rounded-lg border pr-3 pl-9 text-base transition-colors focus:outline-hidden sm:text-sm"
          />
        </div>
      </div>

      {/* Catalog Grouped by Category (Stitch C-01 / C-01b) */}
      {hasAnyProducts ? (
        <div className="flex flex-col gap-6">
          {filteredGroups.map((group, groupIdx) => (
            <section
              key={group.id}
              id={`category-section-${group.id}`}
              aria-labelledby={`category-heading-${group.id}`}
            >
              <div
                ref={groupIdx === 0 ? sentinelRef : undefined}
                data-testid={groupIdx === 0 ? "category-nav-sentinel" : undefined}
                className="mb-2 flex items-center justify-between"
              >
                <h2
                  id={`category-heading-${group.id}`}
                  tabIndex={-1}
                  className="text-foreground scroll-mt-28 text-base font-semibold tracking-tight focus:outline-hidden"
                >
                  {group.name}
                </h2>
                <span className="text-muted-foreground text-xs font-medium tabular-nums">
                  {group.products.length} {group.products.length === 1 ? dict.item : dict.items}
                </span>
              </div>

              <div
                data-testid={`category-group-${group.id}`}
                className="border-border bg-card divide-border divide-y overflow-hidden rounded-xl border sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0 sm:border-0 sm:bg-transparent lg:grid-cols-3"
              >
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
