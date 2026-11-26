"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag, User } from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { StorefrontBusiness } from "@/domain/storefront-business";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import type { StorefrontPickupLocation } from "@/domain/pickup-location";
import { Button } from "@/components/ui/button";
import { useCart } from "../context/cart-context";
import { CheckoutForm } from "./checkout-form";
import type { CheckoutFormData } from "@/domain/checkout";

export interface CheckoutViewProps {
  business: StorefrontBusiness;
  settings: BusinessSettings | null;
  shopPickupEnabled?: boolean;
  pickupLocations?: readonly StorefrontPickupLocation[];
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  isOpen: boolean;
  isAcceptingOrders: boolean;
  /** Request time (ISO) from the server page; seeds the checkout slot lists. */
  nowIso?: string;
  onSubmitOrder?: (data: CheckoutFormData) => Promise<void> | void;
  redirectDelayMs?: number;
}

export function CheckoutView({
  business,
  settings,
  shopPickupEnabled,
  pickupLocations,
  locale,
  dict,
  isOpen,
  isAcceptingOrders,
  nowIso,
  onSubmitOrder,
  redirectDelayMs,
}: CheckoutViewProps) {
  const { items } = useCart();
  const [isOrderSubmitted, setIsOrderSubmitted] = useState(false);

  // If cart is completely empty and an order has not just been submitted, encourage customer to return to catalog
  if (items.length === 0 && !isOrderSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="bg-muted text-muted-foreground mb-4 flex h-20 w-20 items-center justify-center rounded-full">
          <ShoppingBag className="h-10 w-10 opacity-50" />
        </div>
        <h1 className="text-title-sm text-foreground">{dict.emptyCartTitle}</h1>
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
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/cart`}
            aria-label={dict.yourCart}
            className="text-muted-foreground hover:text-foreground hover:bg-muted flex h-10 w-10 items-center justify-center rounded-lg transition-colors active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-title-md text-foreground">{dict.checkoutTitle}</h1>
        </div>

        <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
          <User className="h-3.5 w-3.5 opacity-70" />
          <span>{dict.guestCheckoutBadge}</span>
        </span>
      </div>

      {/* Main Checkout Form */}
      <CheckoutForm
        business={business}
        settings={settings}
        shopPickupEnabled={shopPickupEnabled}
        pickupLocations={pickupLocations}
        locale={locale}
        dict={dict}
        isOpen={isOpen}
        isAcceptingOrders={isAcceptingOrders}
        nowIso={nowIso}
        onSubmitOrder={onSubmitOrder}
        onOrderSuccess={() => setIsOrderSubmitted(true)}
        redirectDelayMs={redirectDelayMs}
      />
    </div>
  );
}
