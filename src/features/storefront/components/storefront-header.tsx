"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Globe } from "lucide-react";
import { APP_METADATA } from "@/config/app";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { useCartOptional } from "../context/cart-context";

export interface StorefrontHeaderProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  cartCount?: number;
}

export function StorefrontHeader({ locale, dict, cartCount }: StorefrontHeaderProps) {
  const pathname = usePathname();
  const nextLocale: SupportedLocale = locale === "en" ? "fr" : "en";
  const cart = useCartOptional();
  const effectiveCartCount = cartCount !== undefined ? cartCount : (cart?.totalCount ?? 0);

  // Compute equivalent pathname with swapped locale prefix
  const targetPathname = pathname.startsWith(`/${locale}`)
    ? pathname.replace(`/${locale}`, `/${nextLocale}`)
    : `/${nextLocale}`;

  return (
    <header className="border-border bg-card/95 sticky top-0 z-40 w-full border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
        {/* Logo / Brand Name */}
        <Link
          href={`/${locale}`}
          className="text-foreground flex items-center gap-2 font-semibold transition-opacity hover:opacity-90"
        >
          <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold">
            F
          </div>
          <span className="text-base tracking-tight">{APP_METADATA.name}</span>
        </Link>

        {/* Actions: Language Switch & Cart Button */}
        <div className="flex items-center gap-2">
          {/* Language Switch */}
          <Link
            href={targetPathname}
            aria-label={dict.switchLanguage}
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-11 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <Globe className="h-4 w-4" />
            <span className="uppercase">{nextLocale}</span>
          </Link>

          {/* Cart Button */}
          <Link
            href={`/${locale}/cart`}
            aria-label={`${dict.cart} (${effectiveCartCount} ${effectiveCartCount === 1 ? dict.item : dict.items})`}
            className="bg-primary text-primary-foreground relative flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2.5 shadow-xs transition-opacity hover:opacity-95"
          >
            <ShoppingCart className="h-5 w-5" />
            {effectiveCartCount > 0 && (
              <span className="bg-secondary text-secondary-foreground border-card absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[11px] font-bold tabular-nums">
                {effectiveCartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
