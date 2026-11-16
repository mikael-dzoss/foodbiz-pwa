"use client";

import Image from "next/image";
import { UtensilsCrossed } from "lucide-react";
import { Badge, Checkbox } from "@/components/ui";
import { formatMoney } from "@/domain/formatting/money";
import type { AddOnCandidates } from "@/domain/add-ons";
import type { StorefrontProduct } from "@/domain/storefront-product";
import type { StorefrontDictionary, SupportedLocale } from "@/domain/i18n";

export interface ProductAddOnGroupProps {
  addOns: AddOnCandidates<StorefrontProduct>;
  selectedIds: readonly string[];
  onToggle: (productId: string) => void;
  locale: SupportedLocale;
  dict: StorefrontDictionary;
  disabled?: boolean;
}

export function ProductAddOnGroup({
  addOns,
  selectedIds,
  onToggle,
  locale,
  dict,
  disabled = false,
}: ProductAddOnGroupProps) {
  if (addOns.products.length === 0) {
    return null;
  }

  const title =
    addOns.kind === "accompaniments" ? dict.addOnsAccompanimentsTitle : dict.addOnsDrinksTitle;

  return (
    <fieldset
      disabled={disabled}
      data-testid="product-addons-group"
      className="border-border/80 bg-card rounded-2xl border p-4"
    >
      <legend className="float-left mb-3 flex w-full items-start justify-between gap-3">
        <div>
          <span className="text-foreground font-headline block text-base leading-snug font-bold">
            {title}
          </span>
          <span className="text-muted-foreground mt-0.5 block text-xs">{dict.addOnsSubtitle}</span>
        </div>
        <Badge variant="completed" data-testid="product-addons-optional-badge">
          {dict.addOnsOptionalBadge}
        </Badge>
      </legend>

      <div className="divide-border/60 clear-both divide-y">
        {addOns.products.map((item) => {
          const checkboxId = `addon-checkbox-${item.id}`;
          const isSelected = selectedIds.includes(item.id);

          return (
            <label
              key={item.id}
              htmlFor={checkboxId}
              data-testid={`product-addon-row-${item.id}`}
              className={`flex min-h-14 items-center justify-between gap-3 py-2.5 transition-opacity duration-150 first:pt-1 last:pb-0 motion-reduce:transition-none ${
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer active:opacity-80"
              }`}
            >
              <div className="bg-muted border-border/60 relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="44px"
                    className="object-cover object-center"
                  />
                ) : (
                  <div
                    data-testid={`product-addon-placeholder-${item.id}`}
                    className="text-muted-foreground flex h-full w-full items-center justify-center"
                  >
                    <UtensilsCrossed className="h-5 w-5 opacity-40" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-foreground block text-sm leading-snug font-semibold">
                  {item.name}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs font-medium tabular-nums">
                  +{formatMoney(item.price, locale)}
                </span>
              </div>

              <Checkbox
                id={checkboxId}
                checked={isSelected}
                onCheckedChange={() => onToggle(item.id)}
                disabled={disabled}
                data-testid={`product-addon-checkbox-${item.id}`}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
