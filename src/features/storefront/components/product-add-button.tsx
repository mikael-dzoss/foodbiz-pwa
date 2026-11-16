"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Plus, Check } from "lucide-react";
import type { StorefrontDictionary } from "@/domain/i18n";
import type { StorefrontProduct } from "@/domain/storefront-product";
import { useCart } from "../context/cart-context";

export function ProductAddButton({
  product,
  dict,
  disabled = false,
  size = "regular",
  "data-testid": testId,
}: {
  product: StorefrontProduct;
  dict: StorefrontDictionary;
  disabled?: boolean;
  /** "compact" (32px) is an owner-approved exception for catalog rows (#228). */
  size?: "regular" | "compact";
  "data-testid": string;
}) {
  const { addItem, getItemQuantity } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const canAdd = product.stock > 0 && !disabled && getItemQuantity(product.id) < product.stock;

  const handleAdd = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canAdd) return;
    if (
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock,
        imageUrl: product.imageUrl,
      })
    ) {
      setJustAdded(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setJustAdded(false), 1200);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={!canAdd}
      aria-label={`${dict.addToCart}: ${product.name}`}
      data-testid={testId}
      data-size={size}
      className={`focus-visible:ring-ring absolute z-10 flex items-center ${
        size === "compact" ? "right-1 bottom-1 h-8 w-8" : "right-1.5 bottom-1.5 min-h-11 min-w-11"
      } justify-center rounded-full border shadow-xs transition-transform duration-150 focus-visible:ring-2 focus-visible:outline-hidden active:scale-95 motion-reduce:transition-none ${
        justAdded
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-primary hover:bg-muted"
      } ${!canAdd ? "cursor-not-allowed opacity-50 active:scale-100" : ""}`}
    >
      {justAdded ? (
        <Check className={size === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      ) : (
        <Plus className={size === "compact" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      )}
      <span className="sr-only">{justAdded ? dict.addedToCart : dict.addToCart}</span>
    </button>
  );
}
