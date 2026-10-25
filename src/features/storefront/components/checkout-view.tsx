"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import type { Business, BusinessSettings } from "@/domain/business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { Button } from "@/components/ui/button";
import { useCart } from "../context/cart-context";
import { CheckoutForm } from "./checkout-form";
import type { CheckoutFormData } from "@/domain/checkout";

export interface CheckoutViewProps {
  business: Business;
  settings: BusinessSettings | null;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  onSubmitOrder?: (data: CheckoutFormData) => Promise<void> | void;
}

export function CheckoutView({
  business,
  settings,
  locale,
  dict,
  onSubmitOrder,
}: CheckoutViewProps) {
  const { items } = useCart();

  // If cart is completely empty, encourage customer to return to catalog
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
        <div className="mt-6 flex gap-3">
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
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/cart`}
            aria-label={dict.yourCart}
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-9 w-9 items-center justify-center rounded-lg transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-xl font-bold tracking-tight">
              {dict.checkoutTitle}
            </h1>
          </div>
        </div>

        <span className="text-muted-foreground text-xs font-medium">
          {dict.cart} → <strong className="text-foreground">{dict.checkoutTitle}</strong>
        </span>
      </div>

      {/* Main Checkout Form */}
      <CheckoutForm
        business={business}
        settings={settings}
        locale={locale}
        dict={dict}
        onSubmitOrder={onSubmitOrder}
      />
    </div>
  );
}
