"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, Check, UtensilsCrossed, Lightbulb, Clock } from "lucide-react";
import { formatMoney } from "@/domain/formatting/money";
import type { AddOnCandidates } from "@/domain/add-ons";
import type { StorefrontProduct } from "@/domain/storefront-product";
import {
  getDictionary,
  interpolate,
  type SupportedLocale,
  type StorefrontDictionary,
} from "@/domain/i18n";
import { Alert } from "@/components/ui";
import { ActionBar } from "@/components/ui/action-bar";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import type { StorefrontProductData } from "../catalog-data";
import { useCart } from "../context/cart-context";
import { ProductAddOnGroup } from "./product-add-on-group";
import { Button } from "@/components/ui/button";

export interface ProductDetailViewProps {
  productData: StorefrontProductData;
  addOns?: AddOnCandidates<StorefrontProduct> | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function ProductDetailView({
  productData,
  addOns = null,
  locale,
  dict,
}: ProductDetailViewProps) {
  const { product, categoryName, business, settings, isAcceptingOrders, isOpen } = productData;
  const { addItem, getItemQuantity } = useCart();
  const productsDict = getDictionary(locale).products;

  const [quantity, setQuantity] = useState(1);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [justAdded, setJustAdded] = useState(false);

  const lowStockThreshold = settings?.lowStockThreshold ?? 5;
  const isOutOfStock = product.stock <= 0;
  const isLowStock = !isOutOfStock && product.stock <= lowStockThreshold;
  const isOrderingPaused = !isAcceptingOrders;
  const isClosedButAccepting = isAcceptingOrders && !isOpen;
  const canOrder = isAcceptingOrders && !isOutOfStock;

  const currentCartQty = getItemQuantity(product.id);
  const maxAddable = Math.max(0, product.stock - currentCartQty);
  const allergens = product.allergens ?? [];

  const selectedAddOns = useMemo(
    () => (addOns ? addOns.products.filter((item) => selectedAddOnIds.includes(item.id)) : []),
    [addOns, selectedAddOnIds],
  );

  const handleToggleAddOn = (addOnId: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(addOnId) ? prev.filter((id) => id !== addOnId) : [...prev, addOnId],
    );
  };

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
      for (const addOn of selectedAddOns) {
        addItem(
          {
            id: addOn.id,
            name: addOn.name,
            price: addOn.price,
            stock: addOn.stock,
            imageUrl: addOn.imageUrl,
          },
          quantity,
        );
      }
      setSelectedAddOnIds([]);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
    }
  };

  const addOnsUnitPrice = selectedAddOns.reduce((sum, item) => sum + item.price, 0);
  const totalPrice = (product.price + addOnsUnitPrice) * quantity;

  return (
    <div className="flex flex-col gap-4 pb-32">
      <span className="sr-only">{business.name}</span>

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
            <h1 className="text-title-lg text-foreground">{product.name}</h1>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-primary block text-2xl font-bold tracking-tight tabular-nums">
              {formatMoney(product.price, locale)}
            </span>
            <span className="text-muted-foreground text-caption block font-medium">
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
                <span className="opacity-80">
                  {" "}
                  · {interpolate(dict.stockAvailable, { count: product.stock })}
                </span>
              </>
            )}
          </span>
          <span className="text-muted-foreground text-xs font-medium">
            {dict.freshlyPreparedToday}
          </span>
        </div>
      </section>

      {/* Closed-hours Scheduling Notice (#350) */}
      {isClosedButAccepting && (
        <Alert
          tone="warning"
          role="none"
          icon={<Clock className="h-4 w-4" />}
          data-testid="product-closed-schedule-notice"
        >
          {dict.storeClosedBanner}
        </Alert>
      )}

      {/* Description, Allergen Badges & Cook's Recommendation Card (Stitch C-02) */}
      <section className="border-border/80 bg-card space-y-3.5 rounded-2xl border p-4">
        {product.description && (
          <p className="text-muted-foreground text-xs leading-relaxed">{product.description}</p>
        )}

        {allergens.length > 0 && (
          <ul
            aria-label={productsDict.allergensLabel}
            data-testid="product-allergens-list"
            className="flex flex-wrap gap-1.5"
          >
            {allergens.map((allergen) => (
              <li
                key={allergen}
                data-testid={`product-allergen-${allergen}`}
                className="border-border bg-muted text-muted-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium"
              >
                {productsDict.allergenLabels[allergen] ?? allergen}
              </li>
            ))}
          </ul>
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

      {addOns && (
        <ProductAddOnGroup
          addOns={addOns}
          selectedIds={selectedAddOnIds}
          onToggle={handleToggleAddOn}
          locale={locale}
          dict={dict}
          disabled={!canOrder}
        />
      )}

      {/* In-Cart Notification */}
      {currentCartQty > 0 && (
        <div className="border-border bg-muted mt-2 flex items-center justify-between rounded-lg border p-3 text-xs">
          <span className="text-muted-foreground font-medium">
            {interpolate(dict.inCartNow, { count: currentCartQty })}
          </span>
          <Link href={`/${locale}/cart`} className="text-primary font-semibold hover:underline">
            {dict.viewCart} →
          </Link>
        </div>
      )}

      {/* Sticky Bottom Action Bar with Stepper & Add Button (Stitch C-02) */}
      <ActionBar placement="bottom" role="complementary" aria-label={dict.purchaseActions}>
        {/* Quantity Stepper */}
        <div className="shrink-0">
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            decreaseLabel={getDictionary(locale).common.decreaseQuantity}
            increaseLabel={getDictionary(locale).common.increaseQuantity}
            min={1}
            max={Math.max(1, product.stock)}
            disabled={!canOrder}
          />
        </div>

        {/* Primary Add to Cart Button */}
        {isOutOfStock ? (
          <Button
            variant="unstyled"
            size="none"
            type="button"
            disabled
            data-testid="product-add-button"
            className="border-border bg-muted text-muted-foreground flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-xl border px-6 text-sm font-semibold opacity-60"
          >
            {dict.outOfStock}
          </Button>
        ) : isOrderingPaused ? (
          <Button
            variant="unstyled"
            size="none"
            type="button"
            disabled
            data-testid="product-add-button"
            className="border-border bg-muted text-muted-foreground flex h-12 flex-1 cursor-not-allowed items-center justify-center rounded-xl border px-4 text-center text-xs font-semibold opacity-60"
          >
            <span>{dict.notAcceptingOrdersShort}</span>
            <span className="sr-only"> — {dict.notAcceptingOrdersBanner}</span>
          </Button>
        ) : (
          <Button
            variant="unstyled"
            size="none"
            type="button"
            onClick={handleAddToCart}
            disabled={!canOrder || maxAddable === 0}
            data-testid="product-add-button"
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
                  {dict.addQuantityToCart.replace("{count}", String(quantity))} •{" "}
                  {formatMoney(totalPrice, locale)}
                </span>
              </>
            )}
          </Button>
        )}
      </ActionBar>
    </div>
  );
}
