"use client";

import Link from "next/link";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import { useCart } from "../context/cart-context";

export interface StorefrontCartBarProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function StorefrontCartBar({ locale, dict }: StorefrontCartBarProps) {
  const { totalCount, totalAmountInCents } = useCart();

  if (totalCount === 0) {
    return null;
  }

  const itemText = totalCount === 1 ? dict.item : dict.items;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="border-border bg-card/95 mx-auto flex max-w-4xl items-center justify-between gap-4 rounded-xl border p-3.5 shadow-lg backdrop-blur-md dark:shadow-black/40">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground relative flex h-10 w-10 items-center justify-center rounded-lg">
            <ShoppingCart className="h-5 w-5" />
            <span className="bg-secondary text-secondary-foreground border-card absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 px-1 text-[11px] font-bold tabular-nums">
              {totalCount}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-foreground text-sm font-semibold tabular-nums">
              {totalCount} {itemText}
            </span>
            <span className="text-muted-foreground text-xs font-bold tabular-nums">
              {formatMoney(totalAmountInCents, locale)}
            </span>
          </div>
        </div>

        <Link
          href={`/${locale}/cart`}
          className="bg-primary text-primary-foreground focus-visible:ring-ring flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:outline-hidden"
        >
          <span>{dict.viewCart}</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
