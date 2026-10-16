"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShoppingBag, Check, UtensilsCrossed } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import type { StorefrontProductData } from "../catalog-data";
import { useCart } from "../context/cart-context";
import { StoreStatusBanner } from "./store-status-banner";

export interface ProductDetailViewProps {
  productData: StorefrontProductData;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function ProductDetailView({ productData, locale, dict }: ProductDetailViewProps) {
  const { product, categoryName, business, settings, isAcceptingOrders, isOpen } = productData;
  const { addItem, getItemQuantity } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const lowStockThreshold = settings?.lowStockThreshold ?? 5;
  const isOutOfStock = product.stock <= 0;
  const isLowStock = !isOutOfStock && product.stock <= lowStockThreshold;
  const canOrder = isAcceptingOrders && !isOutOfStock;

  const currentCartQty = getItemQuantity(product.id);
  const maxAddable = Math.max(0, product.stock - currentCartQty);

  const handleAddToCart = () => {
    if (!canOrder || quantity <= 0) return;

    const added = addItem(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        imageUrl: product.imageUrl,
      },
      quantity,
    );

    if (added) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
    }
  };

  const totalPrice = product.price * quantity;

  return (
    <div className="flex flex-col pb-32">
      {/* Back Link & Store Breadcrumb */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/${locale}`}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{dict.backToCatalog}</span>
        </Link>
        <span className="text-muted-foreground text-xs font-medium">{business.name}</span>
      </div>

      {/* Operational Banner if Store is Closed or Paused */}
      {(!isAcceptingOrders || !isOpen) && (
        <StoreStatusBanner
          isAcceptingOrders={isAcceptingOrders}
          isOpen={isOpen}
          orderTimingScheduled={settings?.orderTimingScheduled ?? true}
          openingHoursText={settings?.openingHours}
          dict={dict}
        />
      )}

      {/* Main Product Card */}
      <article className="border-border bg-card overflow-hidden rounded-2xl border p-4 sm:p-6">
        {/* Showcase Image */}
        <div className="bg-muted relative mb-6 aspect-4/3 w-full overflow-hidden rounded-xl sm:aspect-16/10">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center">
              <UtensilsCrossed className="h-12 w-12 opacity-40" />
            </div>
          )}

          {/* Stock Status Badge */}
          <div className="absolute top-3 right-3">
            {isOutOfStock ? (
              <span className="bg-card/95 text-destructive border-destructive/20 rounded-lg border px-2.5 py-1 text-xs font-semibold backdrop-blur-xs">
                {dict.outOfStock}
              </span>
            ) : isLowStock ? (
              <span className="bg-warning-soft text-warning-soft-foreground rounded-lg px-2.5 py-1 text-xs font-semibold">
                {product.stock} {dict.unitsLeft}
              </span>
            ) : (
              <span className="bg-primary-soft text-primary-soft-foreground rounded-lg px-2.5 py-1 text-xs font-semibold">
                {dict.inStock}
              </span>
            )}
          </div>
        </div>

        {/* Category Pill */}
        <span className="text-muted-foreground mb-1 block text-xs font-medium">{categoryName}</span>

        {/* Product Title & Tabular Price */}
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          <span className="text-foreground text-2xl font-extrabold tabular-nums sm:text-3xl">
            {formatMoney(product.price, locale)}
          </span>
        </div>

        {/* Rich Description */}
        {product.description && (
          <div className="border-border/60 border-t pt-4">
            <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
              {product.description}
            </p>
          </div>
        )}

        {/* In-Cart Notification */}
        {currentCartQty > 0 && (
          <div className="border-border bg-muted mt-6 flex items-center justify-between rounded-lg border p-3 text-xs">
            <span className="text-muted-foreground font-medium">
              Currently in your cart: <strong className="text-foreground">{currentCartQty}</strong>
            </span>
            <Link href={`/${locale}/cart`} className="text-primary font-semibold hover:underline">
              {dict.viewCart} →
            </Link>
          </div>
        )}
      </article>

      {/* Sticky Bottom Action Bar with Stepper & Add Button (Stitch C-02 Light) */}
      <aside
        aria-label="Purchase actions"
        className="border-border bg-card/95 fixed right-0 bottom-0 left-0 z-30 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Quantity Stepper */}
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <span className="text-muted-foreground text-xs font-medium sm:hidden">
              {dict.quantity}:
            </span>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={Math.max(1, product.stock)}
              disabled={!canOrder}
            />
          </div>

          {/* Primary Add to Cart Button */}
          {isOutOfStock ? (
            <button
              type="button"
              disabled
              className="border-border bg-muted text-muted-foreground flex min-h-12 flex-1 cursor-not-allowed items-center justify-center rounded-xl border px-6 text-sm font-semibold opacity-60 sm:flex-initial"
            >
              {dict.outOfStock}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canOrder || maxAddable === 0}
              className={`focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-xs transition-all focus-visible:ring-2 focus-visible:outline-hidden active:scale-98 sm:min-w-60 sm:flex-initial ${
                justAdded
                  ? "bg-primary-soft text-primary-soft-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-95"
              } ${!canOrder || maxAddable === 0 ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {justAdded ? (
                <>
                  <Check className="h-5 w-5" />
                  <span>{dict.addedToCart}</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" />
                  <span>
                    {dict.addToCart} · {formatMoney(totalPrice, locale)}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
