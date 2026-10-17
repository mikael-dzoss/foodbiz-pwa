"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, Check, UtensilsCrossed } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import type { Product } from "@/domain/product";
import { useCart } from "../context/cart-context";
import { useState } from "react";

export interface ProductCatalogCardProps {
  product: Product;
  categoryName?: string;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  lowStockThreshold?: number;
  disabled?: boolean;
  priority?: boolean;
}

export function ProductCatalogCard({
  product,
  categoryName,
  locale,
  dict,
  lowStockThreshold = 5,
  disabled = false,
  priority = false,
}: ProductCatalogCardProps) {
  const { addItem, getItemQuantity } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const currentQty = getItemQuantity(product.id);
  const isOutOfStock = product.stock <= 0;
  const isLowStock = !isOutOfStock && product.stock <= lowStockThreshold;
  const canAdd = !isOutOfStock && !disabled && currentQty < product.stock;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canAdd) return;

    const added = addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      imageUrl: product.imageUrl,
    });

    if (added) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1200);
    }
  };

  return (
    <article className="border-border/60 bg-card group relative flex items-center gap-3 overflow-hidden rounded-lg border p-3 transition-all hover:border-zinc-400 sm:flex-col sm:items-stretch sm:rounded-xl sm:p-4 dark:hover:border-zinc-600">
      {/* Product Image & Thumbnail */}
      <Link
        href={`/${locale}/p/${product.id}`}
        className="bg-muted relative aspect-square h-20 w-20 shrink-0 overflow-hidden rounded-lg sm:aspect-4/3 sm:h-44 sm:w-full"
        tabIndex={-1}
        aria-hidden="true"
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            priority={priority}
            sizes="(max-width: 640px) 80px, (max-width: 1024px) 50vw, 33vw"
            unoptimized={product.imageUrl.startsWith("data:")}
            className="object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-6 w-6 opacity-40 sm:h-8 sm:w-8" />
          </div>
        )}
      </Link>

      {/* Product Content Column */}
      <div className="flex min-w-0 grow flex-col justify-between">
        <div>
          {/* Title & Stock Status Row */}
          <div className="flex items-start justify-between gap-1">
            <h3 className="text-foreground truncate text-sm font-semibold tracking-tight sm:text-base">
              <Link
                href={`/${locale}/p/${product.id}`}
                className="hover:text-primary transition-colors focus-visible:underline focus-visible:outline-hidden"
              >
                {product.name}
              </Link>
            </h3>

            {/* Stock Status Pill */}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                isOutOfStock
                  ? "bg-muted text-muted-foreground"
                  : isLowStock
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              }`}
            >
              {isOutOfStock
                ? dict.outOfStock
                : isLowStock
                  ? `${product.stock} ${dict.unitsLeft}`
                  : dict.inStock}
            </span>
          </div>

          {categoryName && (
            <span className="text-muted-foreground hidden text-xs font-medium sm:block">
              {categoryName}
            </span>
          )}

          {product.description && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs leading-relaxed sm:line-clamp-2">
              {product.description}
            </p>
          )}
        </div>

        {/* Price & Add to Cart Action */}
        <div className="border-border/40 mt-2 flex items-center justify-between gap-2 border-t pt-1 sm:mt-4 sm:pt-3">
          <span className="text-foreground text-sm font-semibold tabular-nums sm:text-base sm:font-bold">
            {formatMoney(product.price, locale)}
          </span>

          {isOutOfStock ? (
            <button
              type="button"
              disabled
              className="border-border/40 bg-muted text-muted-foreground flex h-8 cursor-not-allowed items-center rounded-lg border px-3 text-xs font-semibold opacity-60"
            >
              {dict.outOfStock}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAdd}
              aria-label={`${dict.addToCart}: ${product.name}`}
              className={`flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold shadow-xs transition-all active:scale-95 sm:min-w-18 sm:justify-center ${
                justAdded
                  ? "bg-emerald-600 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              } ${!canAdd ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {justAdded ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{dict.addedToCart}</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  <span>{dict.addToCart}</span>
                  {currentQty > 0 && (
                    <span className="bg-primary-foreground/20 py-0.2 ml-0.5 rounded-full px-1.5 text-[10px] font-bold">
                      {currentQty}
                    </span>
                  )}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
