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
    <article
      data-testid={`product-row-${product.id}`}
      className="bg-card hover:bg-muted/30 sm:border-border group relative flex min-h-24 items-center justify-between gap-3 p-3.5 transition-colors duration-150 motion-reduce:transition-none sm:rounded-xl sm:border"
    >
      {/* Left column: Name, Price, 2-line Clamped Description, Stock state */}
      <div className="min-w-0 flex-1 pr-2">
        <h3 className="text-foreground text-sm leading-snug font-bold">
          <Link
            href={`/${locale}/p/${product.id}`}
            data-testid={`product-link-${product.id}`}
            className="hover:text-primary focus-visible:ring-ring rounded-xs transition-colors duration-150 after:absolute after:inset-0 focus-visible:ring-2 focus-visible:outline-hidden motion-reduce:transition-none"
          >
            {product.name}
          </Link>
        </h3>

        <p className="text-primary mt-0.5 text-sm font-semibold tabular-nums">
          {formatMoney(product.price, locale)}
        </p>

        {product.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
            {product.description}
          </p>
        )}

        {isOutOfStock && (
          <span
            data-testid={`product-out-of-stock-${product.id}`}
            className="bg-muted text-muted-foreground mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
          >
            {dict.outOfStock}
          </span>
        )}

        {isLowStock && (
          <span
            data-testid={`product-low-stock-${product.id}`}
            className="bg-warning-soft text-warning-soft-foreground mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
          >
            {product.stock} {dict.unitsLeft}
          </span>
        )}
      </div>

      {/* Right column: Square rounded image + round icon-only "+" button in bottom-right corner */}
      <div className="bg-muted border-border relative aspect-square h-24 w-24 shrink-0 overflow-hidden rounded-lg border">
        <Link
          href={`/${locale}/p/${product.id}`}
          data-testid={`product-image-link-${product.id}`}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block h-full w-full"
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              priority={priority}
              sizes="96px"
              unoptimized={product.imageUrl.startsWith("data:")}
              className="object-cover transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <div
              data-testid={`product-image-placeholder-${product.id}`}
              className="text-muted-foreground flex h-full w-full items-center justify-center"
            >
              <UtensilsCrossed className="h-6 w-6 opacity-40" />
            </div>
          )}
        </Link>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!canAdd}
          aria-label={`${dict.addToCart}: ${product.name}`}
          data-testid={`add-to-cart-${product.id}`}
          className={`focus-visible:ring-ring absolute right-1.5 bottom-1.5 z-10 flex h-9 min-h-11 w-9 min-w-11 items-center justify-center rounded-full border shadow-xs transition-transform duration-150 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95 motion-reduce:transition-none ${
            justAdded
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-primary hover:bg-muted"
          } ${!canAdd ? "cursor-not-allowed opacity-50 active:scale-100" : ""}`}
        >
          {justAdded ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{dict.addedToCart}</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{dict.addToCart}</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}
