"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, ArrowLeft, Share2, Search } from "lucide-react";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { useCartOptional } from "../context/cart-context";
import { useMenuSearchOptional } from "../context/menu-search-context";
import { StorefrontMenuDrawer } from "./storefront-menu-drawer";

export interface StorefrontHeaderProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  businessName?: string;
  cartCount?: number;
}

export function StorefrontHeader({
  locale,
  dict,
  businessName = "La Petite Boulangerie",
  cartCount,
}: StorefrontHeaderProps) {
  const pathname = usePathname() || `/${locale}`;
  const cart = useCartOptional();
  const effectiveCartCount = cartCount !== undefined ? cartCount : (cart?.totalCount ?? 0);

  // Compute swapped pathname for EN and FR
  const pathForEn = pathname.startsWith(`/${locale}`)
    ? pathname.replace(`/${locale}`, "/en")
    : `/en`;
  const pathForFr = pathname.startsWith(`/${locale}`)
    ? pathname.replace(`/${locale}`, "/fr")
    : `/fr`;

  const localePrefix = `/${locale}`;
  const routePath = pathname.startsWith(localePrefix)
    ? pathname.slice(localePrefix.length) || "/"
    : pathname;
  const isInfoPage = routePath.startsWith("/info");
  const isProductPage = routePath.startsWith("/p/");
  const isHomePage = routePath === "/";
  const isTrackingPage =
    routePath.startsWith("/track") ||
    (routePath.startsWith("/order/") && !routePath.endsWith("/confirmed"));
  const rightAction: "search" | "cart" | "share" | null = isHomePage
    ? "search"
    : isInfoPage
      ? "share"
      : isProductPage || isTrackingPage
        ? "cart"
        : null;
  const menuSearch = useMenuSearchOptional();

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: businessName,
          url: window.location.href,
        });
      } catch {
        // User cancelled or share dismissed
      }
    }
  };

  return (
    <header className="border-border bg-card/95 sticky top-0 z-40 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
        {/* Left Side: Contextual Navigation or Brand Identity */}
        {isInfoPage ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}`}
              aria-label={dict.backToCatalog}
              className="text-primary hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-1.5">
              <h1 className="text-foreground text-base leading-normal font-semibold">
                {dict.storeInfo}
              </h1>
              <span className="border-border bg-muted text-muted-foreground rounded border px-1.5 py-0.5 text-[11px] font-medium">
                {dict.aboutBadge}
              </span>
            </div>
          </div>
        ) : isProductPage ? (
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}`}
              aria-label={dict.backToCatalog}
              className="text-primary hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="text-foreground max-w-[170px] truncate text-base font-bold tracking-tight sm:max-w-xs">
              {businessName}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            <StorefrontMenuDrawer locale={locale} dict={dict} businessName={businessName} />
            <span
              data-testid="header-brand"
              className="text-foreground xs:max-w-[200px] max-w-[160px] truncate text-base font-bold tracking-tight sm:max-w-xs"
            >
              {businessName}
            </span>
          </div>
        )}

        {/* Right Side: Language Toggle + Share or Cart */}
        <div className="flex items-center gap-2">
          {/* Explicit side-by-side [ EN | FR ] toggle pill */}
          <div
            className="bg-muted flex items-center rounded-full p-0.5 text-xs font-semibold"
            role="group"
            aria-label={dict.switchLanguage}
          >
            <Link
              href={pathForEn}
              aria-label={`EN - ${locale === "fr" ? dict.switchLanguage : "English"}`}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                locale === "en"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              EN
            </Link>
            <Link
              href={pathForFr}
              aria-label={`FR - ${locale === "en" ? dict.switchLanguage : "Français"}`}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                locale === "fr"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FR
            </Link>
          </div>

          {/* Contextual action: search (home), share (info), cart (product/tracking), none elsewhere */}
          {rightAction === "search" && (
            <button
              ref={menuSearch?.launcherRef}
              type="button"
              onClick={() => menuSearch?.setOpen(true)}
              aria-label={dict.searchMenu}
              aria-haspopup="dialog"
              data-testid="catalog-search-launcher"
              className="text-foreground hover:bg-muted focus-visible:ring-ring flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-hidden active:scale-95 motion-reduce:transform-none"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {rightAction === "share" ? (
            <button
              type="button"
              onClick={handleShare}
              aria-label={dict.share}
              className="text-primary hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95"
            >
              <Share2 className="h-5 w-5" />
            </button>
          ) : rightAction === "cart" ? (
            <Link
              href={`/${locale}/cart`}
              data-testid="header-cart-link"
              aria-label={`${dict.cart} - ${effectiveCartCount} ${effectiveCartCount === 1 ? dict.item : dict.items}`}
              className="text-muted-foreground hover:bg-muted hover:text-foreground relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {effectiveCartCount > 0 && (
                <span
                  data-testid="header-cart-badge"
                  className="bg-primary text-primary-foreground ring-card absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums shadow-xs ring-2"
                >
                  {effectiveCartCount}
                </span>
              )}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
