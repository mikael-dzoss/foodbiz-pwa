"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingBag, ShoppingCart, Trash2, ArrowRight } from "lucide-react";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import { Button } from "@/components/ui/button";
import { useCart } from "../context/cart-context";
import { CartItemCard } from "./cart-item-card";
import { MinimumOrderBanner } from "./minimum-order-banner";

export interface CartViewProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  minOrderAmount?: number; // cents
  isAcceptingOrders?: boolean;
}

export function CartView({
  locale,
  dict,
  minOrderAmount = 0,
  isAcceptingOrders = true,
}: CartViewProps) {
  const { items, updateQuantity, removeItem, clearCart, totalCount, totalAmountInCents } =
    useCart();

  const isBelowMinimum = minOrderAmount > 0 && totalAmountInCents < minOrderAmount;
  const canProceed = items.length > 0 && !isBelowMinimum && isAcceptingOrders;

  // Empty cart view
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="bg-muted text-muted-foreground mb-4 flex h-20 w-20 items-center justify-center rounded-full">
          <ShoppingBag className="h-10 w-10 opacity-50" />
        </div>
        <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
          {dict.emptyCartTitle}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">{dict.emptyCartMessage}</p>
        <div className="mt-6">
          <Button asChild size="lg" className="rounded-xl px-6">
            <Link href={`/${locale}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {dict.returnToCatalog}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}`}
            aria-label={dict.backToCatalog}
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-xl font-bold tracking-tight">{dict.yourCart}</h1>
            <span
              data-testid="cart-count-badge"
              className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
            >
              {totalCount} {totalCount === 1 ? dict.item : dict.items}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs font-medium transition-colors"
          data-testid="clear-cart-top-button"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>{dict.clearCart}</span>
        </button>
      </div>

      {/* Minimum Order Indicator */}
      <MinimumOrderBanner
        subtotalInCents={totalAmountInCents}
        minOrderAmountInCents={minOrderAmount}
        dict={dict}
        locale={locale}
      />

      {/* Cart Items List */}
      <div className="space-y-3" data-testid="cart-items-list">
        {items.map((item) => (
          <CartItemCard
            key={item.productId}
            item={item}
            onUpdateQuantity={(newQty) => updateQuantity(item.productId, newQty)}
            onRemove={() => removeItem(item.productId)}
            locale={locale}
            dict={dict}
          />
        ))}
      </div>

      {/* Promo & Kitchen Note Placeholder (Signal from Stitch design) */}
      <div className="border-border bg-card text-muted-foreground rounded-xl border p-3.5 text-xs">
        {/* TODO(pricing): wire promo codes (#105) */}
        <p className="italic">{dict.notesPlaceholder}</p>
      </div>

      {/* Order Breakdown Summary Card */}
      <div className="border-border bg-card space-y-2.5 rounded-xl border p-4 shadow-2xs">
        <h2 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {dict.orderSummary}
        </h2>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{dict.subtotal}</span>
          <span className="text-foreground font-medium tabular-nums">
            {formatMoney(totalAmountInCents, locale)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{dict.estimatedTax}</span>
          <span className="text-foreground font-medium tabular-nums">
            {formatMoney(Math.round(totalAmountInCents * 0.1), locale)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{dict.servicePickup}</span>
          <span className="text-primary font-medium">{dict.serviceFree}</span>
        </div>
        <div className="border-border/60 my-2 flex justify-between border-t pt-2.5 text-base font-bold">
          <span className="text-foreground">{dict.orderTotal}</span>
          <span className="text-foreground tabular-nums">
            {formatMoney(totalAmountInCents, locale)}
          </span>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="bg-card/95 border-border pb-safe fixed inset-x-0 bottom-0 z-40 border-t p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={clearCart}
            className="h-12 rounded-xl text-xs sm:text-sm"
            data-testid="clear-cart-bottom-button"
          >
            {dict.clearCart}
          </Button>

          <Button
            asChild={canProceed}
            disabled={!canProceed}
            className="h-12 flex-1 rounded-xl text-sm font-semibold shadow-xs sm:text-base"
            data-testid="proceed-checkout-button"
          >
            {canProceed ? (
              <Link href={`/${locale}/checkout`}>
                <span>
                  {dict.proceedToCheckout} • {formatMoney(totalAmountInCents, locale)}
                </span>
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            ) : (
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                {dict.proceedToCheckout} • {formatMoney(totalAmountInCents, locale)}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
