"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  Check,
  UtensilsCrossed,
  Flame,
  Store,
  Lightbulb,
  AlertTriangle,
} from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { SupportedLocale, StorefrontDictionary } from "@/domain/i18n";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { SoonBadge } from "@/components/feedback";
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
    <div className="flex flex-col gap-4 pb-32">
      <span className="sr-only">{business.name}</span>

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

      {/* Hero Media Showcase Card with Category Pill (Stitch C-02) */}
      <section className="bg-muted border-border/80 relative aspect-4/3 w-full overflow-hidden rounded-2xl border">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 800px"
            unoptimized={product.imageUrl.startsWith("data:")}
            className="object-cover object-center"
          />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <UtensilsCrossed className="h-12 w-12 opacity-40" />
          </div>
        )}

        {categoryName && (
          <div className="absolute top-3 left-3">
            <span className="border-border/80 bg-card/90 text-foreground inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
              {categoryName}
            </span>
          </div>
        )}
      </section>

      {/* Product Header & Pricing Card (Stitch C-02) */}
      <section className="border-border/80 bg-card rounded-2xl border p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-foreground font-headline text-xl leading-snug font-bold">
              {product.name}
            </h1>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-primary font-headline block text-2xl font-bold tracking-tight tabular-nums">
              {formatMoney(product.price, locale)}
            </span>
            <span className="text-muted-foreground block text-[11px] font-medium">
              {dict.perPiece}
            </span>
          </div>
        </div>

        {/* Inventory / Stock Status Pill & Fresh Prep Tag */}
        <div className="border-border/60 mt-3 flex items-center justify-between border-t pt-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isOutOfStock
                ? "bg-muted text-muted-foreground"
                : isLowStock
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOutOfStock
                  ? "bg-muted-foreground"
                  : isLowStock
                    ? "bg-amber-600"
                    : "bg-emerald-600"
              }`}
            />
            {isOutOfStock ? (
              <span>{dict.outOfStock}</span>
            ) : isLowStock ? (
              <span>
                {product.stock} {dict.unitsLeft}
              </span>
            ) : (
              <>
                <span>{dict.inStock}</span>
                <span className="opacity-80"> · {product.stock} available</span>
              </>
            )}
          </span>
          <span className="text-muted-foreground text-xs font-medium">
            {dict.freshlyPreparedToday}
          </span>
        </div>
      </section>

      {/* Prep & Collection Logistics Info Card (Stitch C-02) */}
      <section className="border-border/80 bg-muted/40 space-y-2.5 rounded-2xl border p-3.5">
        <div className="flex items-center gap-3">
          <div className="border-border/60 bg-card text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
            <Flame className="h-4.5 w-4.5" />
          </div>
          <div className="text-xs leading-snug">
            <p className="text-foreground font-semibold">{dict.freshlyPreparedToday}</p>
            <p className="text-muted-foreground">{dict.readyToServe}</p>
          </div>
        </div>
        <div className="border-border/60 border-t" />
        <div className="flex items-center gap-3">
          <div className="border-border/60 bg-card text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
            <Store className="h-4.5 w-4.5" />
          </div>
          <div className="text-xs leading-snug">
            <p className="text-foreground font-semibold">{dict.orderReadyTime}</p>
            <p className="text-muted-foreground truncate">
              {business.address ?? "12 Rue de la Roquette, Paris"}
            </p>
          </div>
        </div>
      </section>

      {/* Description & Cook's Recommendation Card (Stitch C-02) */}
      <section className="border-border/80 bg-card space-y-3.5 rounded-2xl border p-4">
        {product.description && (
          <p className="text-muted-foreground text-xs leading-relaxed">{product.description}</p>
        )}

        {/* Cook's Recommendation / Reheating Advice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
          <Lightbulb className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs leading-normal">
            <span className="mb-0.5 block font-bold text-amber-800 dark:text-amber-300">
              {dict.cooksRecommendation}
            </span>
            <p className="text-muted-foreground">{dict.cooksTip}</p>
          </div>
        </div>
      </section>

      {/* TODO(catalog): Dynamic product ingredients & sourcing provenance (#81) */}
      <section className="border-border/70 bg-card/75 space-y-3 rounded-2xl border p-4 opacity-85">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground font-headline text-sm font-bold">
            {dict.ingredientsAndSourcing}
          </h2>
          <SoonBadge />
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Organic French wheat flour (T65), French AOP cultured butter, natural sourdough levain,
          pure filtered water, Guérande sea salt.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="border-border/50 bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium">
            <Check className="text-primary h-3 w-3" />
            100% Organic Flours
          </span>
          <span className="border-border/50 bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium">
            <Check className="text-primary h-3 w-3" />
            Vegetarian
          </span>
          <span className="border-border/50 bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium">
            <Check className="text-primary h-3 w-3" />
            Artisanal
          </span>
        </div>
      </section>

      {/* TODO(catalog): Dynamic allergen labeling & compliance schema (#81) */}
      <section className="border-border/70 bg-card/75 space-y-2.5 rounded-2xl border p-4 opacity-85">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-foreground font-headline text-sm font-bold">
              {dict.allergenNotice}
            </h2>
          </div>
          <SoonBadge />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
            Gluten (Wheat)
          </span>
          <span className="rounded bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
            Dairy (Butter, Milk)
          </span>
        </div>
        <p className="text-muted-foreground pt-1 text-[11px] leading-tight">
          Produced in an artisanal kitchen. May contain traces of tree nuts, sesame, and eggs.
        </p>
      </section>

      {/* In-Cart Notification */}
      {currentCartQty > 0 && (
        <div className="border-border bg-muted mt-2 flex items-center justify-between rounded-lg border p-3 text-xs">
          <span className="text-muted-foreground font-medium">
            Currently in your cart: <strong className="text-foreground">{currentCartQty}</strong>
          </span>
          <Link href={`/${locale}/cart`} className="text-primary font-semibold hover:underline">
            {dict.viewCart} →
          </Link>
        </div>
      )}

      {/* Sticky Bottom Action Bar with Stepper & Add Button (Stitch C-02) */}
      <aside
        aria-label="Purchase actions"
        className="border-border bg-card/95 fixed right-0 bottom-0 left-0 z-30 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          {/* Quantity Stepper */}
          <div className="shrink-0">
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
              className="border-border bg-muted text-muted-foreground flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-xl border px-6 text-sm font-semibold opacity-60"
            >
              {dict.outOfStock}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canOrder || maxAddable === 0}
              className={`focus-visible:ring-ring flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-xs transition-all focus-visible:ring-2 focus-visible:outline-hidden active:scale-98 ${
                justAdded
                  ? "bg-emerald-600 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/95"
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
