"use client";

import Image from "next/image";
import { Trash2, AlertTriangle, Utensils } from "lucide-react";
import type { CartItem } from "../context/cart-context";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting";
import { QuantityStepper } from "@/components/ui/quantity-stepper";

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
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-3.5 shadow-2xs sm:p-4"
    >
      <div className="flex items-start gap-3">
        {/* Product Image / Placeholder */}
        <div className="border-border bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border sm:h-20 sm:w-20">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 64px, 80px"
              className="object-cover"
            />
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center">
              <Utensils className="h-6 w-6 opacity-40" />
            </div>
          )}
        </div>

        {/* Item Info */}
        <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-foreground truncate text-sm font-semibold sm:text-base">
              {item.name}
            </h3>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${item.name}`}
              className="text-muted-foreground hover:text-destructive hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <p className="text-muted-foreground text-xs tabular-nums">
            {formatMoney(item.price, locale)} {dict.perPiece || "each"}
          </p>

          {/* Stock Constraint Badge */}
          {isAtMaxStock && (
            <div className="border-warning-soft bg-warning-soft/20 text-secondary mt-1 inline-flex w-fit items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium">
              <AlertTriangle className="h-3 w-3" />
              <span>
                {dict.maxStockReached} ({item.maxStock})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls: Quantity Stepper & Line Total */}
      <div className="border-border/60 flex items-center justify-between border-t pt-2.5">
        <QuantityStepper
          value={item.quantity}
          min={1}
          max={item.maxStock}
          onChange={onUpdateQuantity}
          data-testid={`cart-stepper-${item.productId}`}
        />

        <div className="text-right">
          <span className="text-foreground text-sm font-bold tabular-nums sm:text-base">
            {formatMoney(lineTotal, locale)}
          </span>
        </div>
      </div>
    </article>
  );
}
