"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Store, ArrowLeft, Share2 } from "lucide-react";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { useCartOptional } from "../context/cart-context";

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

  const isInfoPage = pathname.includes("/info");
  const isProductPage = pathname.includes("/p/");

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
          <Link
            href={`/${locale}/info`}
            title={businessName}
            className="flex items-center gap-2 transition-opacity hover:opacity-90"
          >
            <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Store className="h-4.5 w-4.5" />
            </div>
            <span className="text-foreground xs:max-w-[200px] max-w-[160px] truncate text-base font-bold tracking-tight sm:max-w-xs">
              {businessName}
            </span>
          </Link>
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
              aria-label={locale === "fr" ? dict.switchLanguage : "English"}
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
              aria-label={locale === "en" ? dict.switchLanguage : "Français"}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                locale === "fr"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              FR
            </Link>
          </div>

          {/* Share Button (on Info Page) or Cart Button */}
          {isInfoPage ? (
            <button
              type="button"
              onClick={handleShare}
              aria-label={dict.share}
              className="text-primary hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95"
            >
              <Share2 className="h-5 w-5" />
            </button>
          ) : (
            <Link
              href={`/${locale}/cart`}
              aria-label={`${dict.cart} (${effectiveCartCount} ${effectiveCartCount === 1 ? dict.item : dict.items})`}
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
          )}
        </div>
      </div>
    </header>
  );
}
