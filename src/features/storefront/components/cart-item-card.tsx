"use client";

import Image from "next/image";
import { X, Utensils } from "lucide-react";
import type { CartItem } from "../context/cart-context";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/domain/i18n";

export interface CartItemCardProps {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
}

export function CartItemCard({
  item,
  onUpdateQuantity,
  onRemove,
  locale,
  dict,
}: CartItemCardProps) {
  const isAtMaxStock = item.quantity >= item.maxStock;
  const lineTotal = item.price * item.quantity;

  return (
    <article
      data-testid={`cart-item-${item.productId}`}
      className="border-border bg-card flex gap-3 rounded-xl border p-3 shadow-2xs"
    >
      {/* Product Image / Placeholder */}
      <div className="border-border bg-muted relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.name} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="text-muted-foreground flex h-full w-full items-center justify-center">
            <Utensils className="h-6 w-6 opacity-40" />
          </div>
        )}
      </div>

      {/* Item Info and Stepper */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-label-md text-foreground truncate">{item.name}</h3>
              {isAtMaxStock && (
                <span className="border-border bg-muted text-muted-foreground text-micro inline-flex items-center rounded border px-1.5 py-0.5 font-medium">
                  {dict.maxStockReached} ({item.maxStock})
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
              {formatMoney(item.price, locale)} {dict.perPiece || "each"}
            </p>
          </div>

          <Button
            variant="unstyled"
            size="none"
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${item.name}`}
            className="text-muted-foreground hover:text-destructive -mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors active:opacity-80"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Footer Row: Line Total on Left, Quantity Stepper on Right */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-foreground text-sm font-bold tabular-nums">
            {formatMoney(lineTotal, locale)}
          </span>

          <QuantityStepper
            value={item.quantity}
            min={1}
            max={item.maxStock}
            onChange={onUpdateQuantity}
            decreaseLabel={getDictionary(locale).common.decreaseQuantity}
            increaseLabel={getDictionary(locale).common.increaseQuantity}
            data-testid={`cart-stepper-${item.productId}`}
          />
        </div>
      </div>
    </article>
  );
}
