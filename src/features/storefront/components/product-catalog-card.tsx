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
}

export function ProductCatalogCard({
  product,
  categoryName,
  locale,
  dict,
  lowStockThreshold = 5,
  disabled = false,
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
    <article className="border-border bg-card group relative flex flex-col justify-between overflow-hidden rounded-xl border p-4 transition-all hover:border-zinc-400 dark:hover:border-zinc-600">
      <div>
        {/* Product Image & Badges */}
        <Link
          href={`/${locale}/p/${product.id}`}
          className="bg-muted relative mb-3 block aspect-4/3 w-full overflow-hidden rounded-lg"
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-8 w-8 opacity-40" />
            </div>
          )}

          {/* Availability Badge */}
          <div className="absolute top-2 right-2">
            {isOutOfStock ? (
              <span className="bg-card/90 text-destructive border-destructive/20 rounded-md border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-xs">
                {dict.outOfStock}
              </span>
            ) : isLowStock ? (
              <span className="bg-warning-soft text-warning-soft-foreground rounded-md px-2 py-0.5 text-[11px] font-semibold">
                {product.stock} {dict.unitsLeft}
              </span>
            ) : (
              <span className="bg-primary-soft text-primary-soft-foreground rounded-md px-2 py-0.5 text-[11px] font-semibold">
                {dict.inStock}
              </span>
            )}
          </div>
        </Link>

        {/* Category Pill */}
        {categoryName && (
          <span className="text-muted-foreground mb-1 block text-xs font-medium">
            {categoryName}
          </span>
        )}

        {/* Title & Description */}
        <h3 className="text-foreground text-base font-semibold tracking-tight">
          <Link
            href={`/${locale}/p/${product.id}`}
            className="hover:text-primary transition-colors focus-visible:underline focus-visible:outline-hidden"
          >
            {product.name}
          </Link>
        </h3>

        {product.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
            {product.description}
          </p>
        )}
      </div>

      {/* Price & Add to Cart Action */}
      <div className="border-border/60 mt-4 flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-foreground text-base font-bold tabular-nums">
          {formatMoney(product.price, locale)}
        </span>

        {isOutOfStock ? (
          <button
            type="button"
            disabled
            className="border-border bg-muted text-muted-foreground flex min-h-11 cursor-not-allowed items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold opacity-60"
          >
            {dict.outOfStock}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAdd}
            aria-label={`${dict.addToCart}: ${product.name}`}
            className={`focus-visible:ring-ring flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs transition-all focus-visible:ring-2 focus-visible:outline-hidden active:scale-95 ${
              justAdded
                ? "bg-primary-soft text-primary-soft-foreground"
                : "bg-primary text-primary-foreground hover:opacity-95"
            } ${!canAdd ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4" />
                <span>{dict.addedToCart}</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>{dict.addToCart}</span>
                {currentQty > 0 && (
                  <span className="bg-primary-foreground/20 py-0.2 ml-1 rounded-full px-1.5 text-[10px] font-bold">
                    {currentQty}
                  </span>
                )}
              </>
            )}
          </button>
        )}
      </div>
    </article>
  );
}
