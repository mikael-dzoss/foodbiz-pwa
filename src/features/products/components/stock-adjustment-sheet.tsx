"use client";

import * as React from "react";
import Image from "next/image";
import { Check, AlertTriangle, Package, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatMoney, getStockStatus } from "@/domain";
import { adjustProductStockAction } from "../product-actions";
import type { EnrichedProduct } from "../product-data";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";

export interface StockAdjustmentSheetProps {
  product: EnrichedProduct | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStockAdjusted?: (productId: string, newStock: number) => void;
  lowStockThreshold?: number;
}

const QUICK_ADJUST_DELTAS = [-10, -5, -1, 1, 5, 10];
/** Stored with the stock movement (English, language-neutral data); the screen shows localized labels. */
const REASONS = ["Restock / Delivery", "Inventory count", "Waste / Damaged"] as const;
const REASON_KEYS = {
  "Restock / Delivery": "restock",
  "Inventory count": "count",
  "Waste / Damaged": "waste",
} as const;

export function StockAdjustmentSheet({
  product,
  isOpen,
  onOpenChange,
  onStockAdjusted,
  lowStockThreshold = 5,
}: StockAdjustmentSheetProps) {
  const { locale, dict } = useManagerLocale();
  const t = dict.productsAdmin.stock;
  const normalizedProduct = product ?? null;
  const [prevProduct, setPrevProduct] = React.useState<EnrichedProduct | null>(normalizedProduct);
  const [prevIsOpen, setPrevIsOpen] = React.useState<boolean>(isOpen);
  const [targetStock, setTargetStock] = React.useState<number>(normalizedProduct?.stock ?? 0);
  const [selectedReason, setSelectedReason] = React.useState<string>(REASONS[0]);
  const [error, setError] = React.useState<string | null>(null);
  const [, saveAction, isPending] = React.useActionState(async (): Promise<null> => {
    if (!product) return null;
    if (targetStock < 0) {
      setError(t.negative);
      return null;
    }

    setError(null);
    const res = await adjustProductStockAction({
      productId: product.id,
      stock: targetStock,
      reason: selectedReason,
    });
    if (res.ok) {
      onStockAdjusted?.(product.id, targetStock);
      onOpenChange(false);
    } else {
      setError(actionErrorMessage(res, locale));
    }
    return null;
  }, null);

  // Sync state when product prop or isOpen changes without triggering effect cascading renders
  if (normalizedProduct !== prevProduct || isOpen !== prevIsOpen) {
    setPrevProduct(normalizedProduct);
    setPrevIsOpen(isOpen);
    if (normalizedProduct) {
      setTargetStock(normalizedProduct.stock);
      setSelectedReason(REASONS[0]);
      setError(null);
    }
  }

  if (!product) return null;

  const currentStock = product.stock;
  const stockDifference = targetStock - currentStock;
  const currentStatus = getStockStatus(currentStock, lowStockThreshold);
  const projectedStatus = getStockStatus(targetStock, lowStockThreshold);

  const handleDelta = (delta: number) => {
    setTargetStock((prev) => Math.max(0, prev + delta));
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) {
      setTargetStock(0);
    } else {
      setTargetStock(Math.max(0, val));
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg p-0"
        data-testid="stock-adjustment-sheet"
      >
        {/* Header from Stitch M-43 Canvas */}
        <SheetHeader className="border-border border-b px-5 pt-4 pr-12 pb-3 text-left">
          <SheetTitle className="text-foreground">{t.title}</SheetTitle>
          <p className="text-muted-foreground text-xs font-medium">
            {product.name} · {product.categoryName}
          </p>
        </SheetHeader>

        <form action={saveAction}>
          <div className="space-y-4 px-5 py-4">
            {/* Section 1: Current Stock Summary Card */}
            <div className="border-border bg-muted/30 flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <div className="border-border bg-card relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="48px"
                      unoptimized={product.imageUrl.startsWith("data:")}
                      className="object-cover"
                    />
                  ) : (
                    <Package className="text-muted-foreground h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">{product.name}</p>
                  <p className="text-muted-foreground text-xs font-medium tabular-nums">
                    {formatMoney(product.price, locale)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                {currentStatus === "out_of_stock" && (
                  <Badge variant="destructive" className="font-semibold">
                    {t.stockOut}
                  </Badge>
                )}
                {currentStatus === "low_stock" && (
                  <Badge variant="warning" className="font-semibold">
                    {interpolate(t.stockLow, { count: currentStock })}
                  </Badge>
                )}
                {currentStatus === "in_stock" && (
                  <Badge variant="success" className="font-semibold">
                    {interpolate(t.stockIn, { count: currentStock })}
                  </Badge>
                )}
                <p className="text-muted-foreground text-caption mt-1">
                  {interpolate(t.alertBelow, { count: lowStockThreshold })}
                </p>
              </div>
            </div>

            {/* Section 2: Stock Quantity Controls Card */}
            <div className="border-border bg-card space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {t.adjustQuantity}
                </span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {interpolate(t.current, { count: currentStock })}
                </span>
              </div>

              {/* Large Digital Counter Display */}
              <div className="py-2 text-center">
                <div
                  className="text-foreground text-4xl font-extrabold tracking-tight tabular-nums"
                  data-testid="target-stock-display"
                >
                  {targetStock}
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">{t.newTotal}</p>
              </div>

              {/* Quick Adjustment Chips Row */}
              <div className="grid grid-cols-6 gap-1.5">
                {QUICK_ADJUST_DELTAS.map((delta) => (
                  <Button
                    key={delta}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelta(delta)}
                    className="text-foreground hover:bg-muted h-10 px-0 font-semibold tabular-nums"
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </Button>
                ))}
              </div>

              {/* Direct Numerical Input Option */}
              <Field id="direct-stock-input" label={t.exactLabel} className="pt-2">
                {(control) => (
                  <div className="relative">
                    <Input
                      {...control}
                      type="number"
                      min="0"
                      step="1"
                      value={targetStock}
                      onChange={handleDirectInput}
                      className="h-11 pr-14 text-base font-semibold tabular-nums"
                      data-testid="direct-stock-input"
                    />
                    <span className="text-muted-foreground pointer-events-none absolute top-3 right-3 text-xs font-medium">
                      {t.units}
                    </span>
                  </div>
                )}
              </Field>
            </div>

            {/* Section 3: Difference Banner & Reason */}
            <div className="bg-primary-soft/40 border-primary-soft text-primary-soft-foreground flex items-center justify-between rounded-lg border p-2.5 text-xs font-semibold">
              <span>
                {interpolate(t.difference, {
                  delta: stockDifference >= 0 ? `+${stockDifference}` : stockDifference,
                })}
              </span>
              <span>
                {interpolate(t.newStock, { count: targetStock })}
                {projectedStatus === "low_stock" && (
                  <span className="text-warning-soft-foreground ml-1.5 inline-flex items-center gap-1 font-medium">
                    <AlertTriangle className="text-warning inline h-3 w-3" /> {t.low}
                  </span>
                )}
              </span>
            </div>

            {/* Adjustment Reason Pills */}
            <div>
              <label className="text-foreground mb-1.5 block text-xs font-semibold">
                {t.reasonLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {REASONS.map((r) => (
                  <Button
                    variant="unstyled"
                    size="none"
                    key={r}
                    type="button"
                    onClick={() => setSelectedReason(r)}
                    className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors ${
                      selectedReason === r
                        ? "border-primary bg-primary-soft text-primary font-semibold"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t.reasons[REASON_KEYS[r]]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p
                className="text-destructive text-xs font-medium"
                role="alert"
                data-testid="stock-error"
              >
                {error}
              </p>
            )}

            <p className="text-muted-foreground text-caption">{t.note}</p>
          </div>

          {/* Action Footer */}
          {/* TODO(design): scale down action buttons from h-12 to min-h-11 to align with Stitch mobile tokens */}
          <div className="border-border bg-card pb-safe-4 flex items-center gap-3 border-t px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-12 flex-1 font-semibold"
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 flex-2 font-semibold"
              data-testid="confirm-stock-update"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5" />
              )}
              {t.update}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
