"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  ArrowRight,
  FileText,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import type { StorefrontPickupLocation } from "@/domain/pickup-location";
import { splitOrderTotal } from "@/domain/pricing";
import { logEvent } from "@/lib/log";
import { ActionBar } from "@/components/ui/action-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToastOptional } from "@/components/ui";
import { SoonBadge } from "@/components/feedback";
import { resolveServiceMode, useCart } from "../context/cart-context";
import { storefrontPricing } from "../storefront-pricing";
import { usePickupLocation } from "../use-pickup-location";
import { CartItemCard } from "./cart-item-card";
import { MinimumOrderBanner } from "./minimum-order-banner";

const EMPTY_PICKUP_LOCATIONS: readonly StorefrontPickupLocation[] = [];

export interface CartViewProps {
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  minOrderAmount?: number; // cents
  isAcceptingOrders?: boolean;
  settings?: Pick<BusinessSettings, "serviceTypes" | "deliveryFee" | "shopPickupEnabled"> | null;
  shopPickupEnabled?: boolean;
  pickupLocations?: readonly StorefrontPickupLocation[];
}

export function CartView({
  locale,
  dict,
  minOrderAmount = 0,
  isAcceptingOrders = true,
  settings = null,
  shopPickupEnabled,
  pickupLocations = EMPTY_PICKUP_LOCATIONS,
}: CartViewProps) {
  const { items, updateQuantity, removeItem, clearCart, totalCount, notes, setNotes, serviceMode } =
    useCart();
  const toast = useToastOptional();
  const showToast = toast?.showToast ?? (() => {});
  const [isNotesOpen, setIsNotesOpen] = useState(notes.length > 0);
  const pricingErrorId = useId();

  const activeServiceMode = resolveServiceMode(serviceMode, settings?.serviceTypes);
  const resolvedShopPickupEnabled = shopPickupEnabled ?? settings?.shopPickupEnabled ?? true;
  const pickupState = usePickupLocation(resolvedShopPickupEnabled, pickupLocations);

  const pricing = useMemo(
    () =>
      storefrontPricing({
        items,
        serviceType: activeServiceMode,
        deliveryFee: settings?.deliveryFee ?? 0,
        pickupFee: activeServiceMode === "pickup" ? (pickupState.selectedRelay?.feeCents ?? 0) : 0,
      }),
    [items, activeServiceMode, settings?.deliveryFee, pickupState.selectedRelay?.feeCents],
  );

  const pricingErrorReason = pricing.ok ? null : pricing.reason;
  useEffect(() => {
    if (!pricingErrorReason) return;
    logEvent("error", "storefront_pricing_failed", {
      screen: "cart",
      serviceType: activeServiceMode,
      reason: pricingErrorReason,
    });
  }, [pricingErrorReason, activeServiceMode]);

  const breakdown = pricing.ok
    ? splitOrderTotal(pricing.total, pricing.deliveryFee + pricing.pickupFee)
    : null;
  const isBelowMinimum = pricing.ok && minOrderAmount > 0 && pricing.subtotal < minOrderAmount;
  const canProceed = items.length > 0 && pricing.ok && !isBelowMinimum && isAcceptingOrders;

  const feeLabel =
    activeServiceMode === "delivery"
      ? dict.deliveryFee
      : pickupState.selectedRelay
        ? `${dict.pickupLocationFeeLabel} · ${pickupState.selectedRelay.name}`
        : dict.pickupLocationFeeLabel;
  const feeValue = pricing.ok
    ? activeServiceMode === "delivery"
      ? pricing.deliveryFee > 0
        ? formatMoney(pricing.deliveryFee, locale)
        : dict.pickupLocationFeeFree
      : pricing.pickupFee > 0
        ? formatMoney(pricing.pickupFee, locale)
        : pickupState.requiresChoice && pickupState.hasPaidOption
          ? dict.pickupLocationFeePending
          : dict.pickupLocationFeeFree
    : null;

  // Empty cart view
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="bg-muted text-muted-foreground mb-4 flex h-20 w-20 items-center justify-center rounded-full">
          <ShoppingBag className="h-10 w-10 opacity-50" />
        </div>
        <h1 className="text-title-sm text-foreground">{dict.emptyCartTitle}</h1>
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}`}
            aria-label={dict.backToCatalog}
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-10 w-10 items-center justify-center rounded-lg transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-title-md text-foreground">{dict.yourCart}</h1>
            <span
              data-testid="cart-count-badge"
              className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
            >
              {totalCount} {totalCount === 1 ? dict.item : dict.items}
            </span>
          </div>
        </div>

        <Button
          variant="unstyled"
          size="none"
          type="button"
          onClick={clearCart}
          aria-label={dict.clearCart}
          className="text-muted-foreground hover:text-destructive hover:bg-muted flex h-10 w-10 items-center justify-center rounded-lg transition-colors active:opacity-80"
          data-testid="clear-cart-top-button"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Minimum Order Indicator */}
      {pricing.ok && (
        <MinimumOrderBanner
          subtotalInCents={pricing.subtotal}
          minOrderAmountInCents={minOrderAmount}
          dict={dict}
          locale={locale}
        />
      )}

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

      {/* Promo Code Section (Upcoming Feature with SoonBadge and Toast) */}
      <section className="border-border bg-card space-y-3 rounded-xl border p-3.5 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <label htmlFor="promo-input" className="text-muted-foreground">
              {dict.discountCode}
            </label>
            <SoonBadge label={dict.soon} data-testid="discount-soon-badge" />
          </div>
          <Button
            variant="unstyled"
            size="none"
            type="button"
            onClick={() => showToast(dict.voucherUnavailableNotice)}
            className="text-primary cursor-pointer text-xs font-medium hover:underline"
            data-testid="have-voucher-button"
          >
            {dict.haveVoucher}
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            id="promo-input"
            type="text"
            placeholder={dict.promoPlaceholder}
            disabled
            aria-label={`${dict.discountCode} (${dict.soon})`}
            className="h-9"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled
            className="h-9 px-3 text-xs font-semibold"
          >
            {dict.applyDiscount}
          </Button>
        </div>
        {/* TODO(pricing): wire promo codes (#105) */}
      </section>

      {/* Kitchen / Packing Notes Disclosure */}
      <section className="border-border bg-card overflow-hidden rounded-xl border shadow-2xs">
        <Button
          variant="unstyled"
          size="none"
          type="button"
          onClick={() => setIsNotesOpen((prev) => !prev)}
          aria-expanded={isNotesOpen}
          aria-controls="kitchen-notes-collapse"
          className="hover:bg-muted/50 flex w-full items-center justify-between p-3.5 text-left text-xs font-medium transition-colors"
          data-testid="toggle-kitchen-note-btn"
        >
          <div className="text-foreground flex items-center gap-2 font-medium">
            <FileText className="text-primary h-4 w-4" />
            <span>{dict.addKitchenNote}</span>
          </div>
          {isNotesOpen ? (
            <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4 transition-transform" />
          )}
        </Button>

        {isNotesOpen && (
          <div id="kitchen-notes-collapse" className="border-border/60 border-t p-3.5 pt-2">
            <Textarea
              id="cart-kitchen-note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={dict.notesPlaceholder}
              rows={3}
              className="resize-none"
              data-testid="cart-kitchen-note-input"
            />
          </div>
        )}
      </section>

      {/* Order Breakdown Summary Card */}
      <section className="border-border bg-card space-y-2.5 rounded-xl border p-4 shadow-2xs">
        <h2 className="text-label-sm text-muted-foreground tracking-wider uppercase">
          {dict.orderSummary}
        </h2>
        {pricing.ok && breakdown ? (
          <>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">{dict.subtotal}</span>
              <span
                data-testid="cart-subtotal-value"
                className="text-foreground font-medium tabular-nums"
              >
                {formatMoney(breakdown.subtotal, locale)}
              </span>
            </div>
            <div className="flex justify-between text-xs sm:text-sm">
              <span className="text-muted-foreground">{dict.cartIncludedVat}</span>
              <span
                data-testid="cart-tax-value"
                className="text-foreground font-medium tabular-nums"
              >
                {formatMoney(breakdown.includedTax, locale)}
              </span>
            </div>
            <div
              data-testid="cart-fee-row"
              className="flex justify-between gap-2 text-xs sm:text-sm"
            >
              <span className="text-muted-foreground truncate">{feeLabel}</span>
              <span
                data-testid="cart-fee-value"
                className={
                  pricing.deliveryFee > 0 || pricing.pickupFee > 0
                    ? "text-foreground shrink-0 font-medium tabular-nums"
                    : "text-primary shrink-0 font-medium tabular-nums"
                }
              >
                {feeValue}
              </span>
            </div>
            <div className="border-border/60 my-1 flex justify-between border-t pt-2.5 text-sm font-bold sm:text-base">
              <span className="text-foreground">{dict.orderTotal}</span>
              <span data-testid="cart-order-total" className="text-foreground tabular-nums">
                {formatMoney(breakdown.totalAmount, locale)}
              </span>
            </div>
          </>
        ) : (
          <div
            id={pricingErrorId}
            role="alert"
            data-testid="cart-pricing-error"
            className="border-destructive/30 bg-destructive/10 text-destructive text-body-sm flex items-start gap-2 rounded-xl border p-3"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 wrap-anywhere">{dict.pricingUnavailableError}</span>
          </div>
        )}

        {isBelowMinimum && (
          <div className="border-border bg-muted/60 text-muted-foreground text-caption mt-2 flex items-center gap-2 rounded-lg border p-2">
            <AlertTriangle className="text-secondary h-3.5 w-3.5 shrink-0" />
            <span>
              {dict.orderThresholdNotice.replace("{min}", formatMoney(minOrderAmount, locale))}
            </span>
          </div>
        )}
      </section>

      {/* In-flow sticky actions bar: settles above the footer at the end of the content (#237) */}
      <ActionBar
        placement="floating"
        contentClassName="flex items-center gap-3"
        data-testid="cart-action-bar"
      >
        <Button
          type="button"
          variant="outline"
          onClick={clearCart}
          className="h-12 rounded-xl px-4 text-xs font-semibold sm:text-sm"
          data-testid="clear-cart-bottom-button"
        >
          {dict.clearCart}
        </Button>

        <Button
          asChild={canProceed}
          disabled={!canProceed}
          aria-describedby={!pricing.ok ? pricingErrorId : undefined}
          className="h-12 flex-1 rounded-xl text-sm font-semibold shadow-xs sm:text-base"
          data-testid="proceed-checkout-button"
        >
          {canProceed && pricing.ok ? (
            <Link href={`/${locale}/checkout`}>
              <span>
                {dict.proceedToCheckout} • {formatMoney(pricing.total, locale)}
              </span>
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          ) : (
            <span className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              {pricing.ok
                ? `${dict.proceedToCheckout} • ${formatMoney(pricing.total, locale)}`
                : dict.proceedToCheckout}
            </span>
          )}
        </Button>
      </ActionBar>
    </div>
  );
}
