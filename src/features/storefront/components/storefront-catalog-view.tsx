"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  CategoryNav,
  prefersReducedMotion,
  useScrollPastSentinel,
  useScrollSpy,
} from "@/components/navigation";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import type { StorefrontCatalogData } from "../catalog-data";
import { ServiceToggleHeader } from "./service-toggle-header";
import { FeaturedCarousel } from "./featured-carousel";
import { ProductCatalogCard } from "./product-catalog-card";
import { StorefrontCartBar } from "./storefront-cart-bar";
import { MenuSearchDialog } from "./menu-search-dialog";
import { useMenuSearchOptional } from "../context/menu-search-context";

export interface StorefrontCatalogViewProps {
  catalog: StorefrontCatalogData;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function StorefrontCatalogView({ catalog, locale, dict }: StorefrontCatalogViewProps) {
  const menuSearch = useMenuSearchOptional();
  const [localSearchOpen, setLocalSearchOpen] = useState(false);
  const searchOpen = menuSearch?.open ?? localSearchOpen;
  const setSearchOpen = menuSearch?.setOpen ?? setLocalSearchOpen;

  const groupedCategories = catalog.groupedCategories;
  const hasAnyProducts = groupedCategories.some((g) => g.products.length > 0);
  const hasFeatured = catalog.featuredProducts.length > 0;
  const navItems = useMemo(
    () => [
      ...(hasFeatured ? [{ id: "featured", label: dict.featuredItems }] : []),
      ...groupedCategories.map((g) => ({ id: g.id, label: g.name })),
    ],
    [hasFeatured, dict.featuredItems, groupedCategories],
  );

  const sectionIds = useMemo(() => navItems.map((item) => item.id), [navItems]);

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

  const handleRestoreLauncherFocus = () => {
    menuSearch?.launcherRef.current?.focus({ preventScroll: true });
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

      {/* Catalog Grouped by Category (Stitch C-01 / C-01b) */}
      {hasAnyProducts ? (
        <div className="flex flex-col gap-6">
          <FeaturedCarousel
            products={catalog.featuredProducts}
            locale={locale}
            dict={dict}
            disabled={!catalog.isAcceptingOrders}
            headingRef={hasFeatured ? sentinelRef : undefined}
          />
          {groupedCategories.map((group, groupIdx) => (
            <section
              key={group.id}
              id={`category-section-${group.id}`}
              aria-labelledby={`category-heading-${group.id}`}
            >
              <div
                ref={groupIdx === 0 && !hasFeatured ? sentinelRef : undefined}
                data-testid={groupIdx === 0 && !hasFeatured ? "category-nav-sentinel" : undefined}
                className="mb-2 flex min-h-11 items-center justify-between gap-2"
              >
                <div className="flex items-baseline gap-2">
                  <h2
                    id={`category-heading-${group.id}`}
                    tabIndex={-1}
                    className="text-title-sm text-foreground scroll-mt-28 focus:outline-hidden"
                  >
                    {group.name}
                  </h2>
                  <span className="text-muted-foreground text-xs font-medium tabular-nums">
                    {group.products.length} {group.products.length === 1 ? dict.item : dict.items}
                  </span>
                </div>
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

          {/* Store Hours & Shop Info Box (Stitch C-01) */}
          <Link
            href={`/${locale}/info`}
            className="border-border/60 bg-muted/40 hover:bg-muted/70 text-muted-foreground mt-2 flex items-center justify-between rounded-lg border p-3 text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="text-primary h-4 w-4 shrink-0" />
              <span>{dict.storeInfo}</span>
            </div>
            <span className="text-primary text-caption flex shrink-0 items-center gap-1 font-semibold">
              {dict.shopInfoCta ?? "Shop Info"} →
            </span>
          </Link>
        </div>
      ) : (
        <div className="border-border bg-card my-8 flex flex-col items-center justify-center rounded-xl border p-8 text-center">
          <p className="text-foreground text-sm font-semibold">{dict.noProductsInCategory}</p>
        </div>
      )}

      {/* Full-Screen Menu Search Overlay (Stitch C-01d, #203) */}
      <MenuSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onCloseRestoreFocus={handleRestoreLauncherFocus}
        groupedCategories={groupedCategories}
        businessName={catalog.business.name}
        lowStockThreshold={catalog.settings?.lowStockThreshold ?? 5}
        isAcceptingOrders={catalog.isAcceptingOrders}
        locale={locale}
        dict={dict}
      />

      {/* Floating Bottom Cart Bar */}
      {!searchOpen && <StorefrontCartBar locale={locale} dict={dict} />}
    </div>
  );
}
