"use client";

import * as React from "react";
import Image from "next/image";
import { Check, AlertTriangle, Package, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatMoney, getStockStatus } from "@/domain";
import { adjustProductStockAction } from "../product-actions";
import type { EnrichedProduct } from "../product-data";

export interface StockAdjustmentSheetProps {
  product: EnrichedProduct | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStockAdjusted?: (productId: string, newStock: number) => void;
  lowStockThreshold?: number;
}

const QUICK_ADJUST_DELTAS = [-10, -5, -1, 1, 5, 10];
const REASONS = ["Restock / Delivery", "Inventory count", "Waste / Damaged"] as const;

export function StockAdjustmentSheet({
  product,
  isOpen,
  onOpenChange,
  onStockAdjusted,
  lowStockThreshold = 5,
}: StockAdjustmentSheetProps) {
  const normalizedProduct = product ?? null;
  const [prevProduct, setPrevProduct] = React.useState<EnrichedProduct | null>(normalizedProduct);
  const [prevIsOpen, setPrevIsOpen] = React.useState<boolean>(isOpen);
  const [targetStock, setTargetStock] = React.useState<number>(normalizedProduct?.stock ?? 0);
  const [selectedReason, setSelectedReason] = React.useState<string>(REASONS[0]);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

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

  const handleSave = () => {
    if (targetStock < 0) {
      setError("Stock cannot be set below 0.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await adjustProductStockAction({
        productId: product.id,
        stock: targetStock,
        reason: selectedReason,
      });
      if (res.ok) {
        onStockAdjusted?.(product.id, targetStock);
        onOpenChange(false);
      } else {
        setError(res.message || "Failed to adjust stock");
      }
    });
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
          <SheetTitle className="text-foreground text-lg font-bold">Adjust Stock</SheetTitle>
          <p className="text-muted-foreground text-xs font-medium">
            {product.name} · {product.categoryName}
          </p>
        </SheetHeader>

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
                  {formatMoney(product.price)}
                </p>
              </div>
            </div>

            <div className="text-right">
              {currentStatus === "out_of_stock" && (
                <Badge variant="destructive" className="font-semibold">
                  0 in stock
                </Badge>
              )}
              {currentStatus === "low_stock" && (
                <Badge variant="warning" className="font-semibold">
                  {currentStock} left
                </Badge>
              )}
              {currentStatus === "in_stock" && (
                <Badge variant="success" className="font-semibold">
                  {currentStock} in stock
                </Badge>
              )}
              <p className="text-muted-foreground mt-1 text-[11px]">
                Alert below {lowStockThreshold}
              </p>
            </div>
          </div>

          {/* Section 2: Stock Quantity Controls Card */}
          <div className="border-border bg-card space-y-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Adjust Quantity
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                Current: {currentStock} units
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
              <p className="text-muted-foreground mt-0.5 text-xs">New total units</p>
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
            <div className="pt-2">
              <label
                htmlFor="direct-stock-input"
                className="text-muted-foreground mb-1 block text-xs font-medium"
              >
                Or enter exact quantity
              </label>
              <div className="relative">
                <Input
                  id="direct-stock-input"
                  type="number"
                  min="0"
                  step="1"
                  value={targetStock}
                  onChange={handleDirectInput}
                  className="h-11 pr-14 text-base font-semibold tabular-nums"
                  data-testid="direct-stock-input"
                />
                <span className="text-muted-foreground pointer-events-none absolute top-3 right-3 text-xs font-medium">
                  units
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Difference Banner & Reason */}
          <div className="bg-primary-soft/40 border-primary-soft text-primary-soft-foreground flex items-center justify-between rounded-lg border p-2.5 text-xs font-semibold">
            <span>
              Difference: {stockDifference >= 0 ? `+${stockDifference}` : stockDifference} units
            </span>
            <span>
              New stock: {targetStock}
              {projectedStatus === "low_stock" && (
                <span className="text-warning ml-1.5 inline-flex items-center gap-1 font-medium">
                  <AlertTriangle className="inline h-3 w-3" /> Low
                </span>
              )}
            </span>
          </div>

          {/* Adjustment Reason Pills */}
          <div>
            <label className="text-foreground mb-1.5 block text-xs font-semibold">
              Reason for adjustment
            </label>
            <div className="grid grid-cols-3 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedReason(r)}
                  className={`rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors ${
                    selectedReason === r
                      ? "border-primary bg-primary-soft text-primary font-semibold"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-destructive text-xs font-medium" role="alert">
              {error}
            </p>
          )}

          <p className="text-muted-foreground text-[11px]">
            Stock cannot be set below 0 units. Past order history is strictly preserved.
          </p>
        </div>

        {/* Action Footer */}
        {/* TODO(design): scale down action buttons from h-12 to min-h-11 to align with Stitch mobile tokens */}
        <div className="border-border bg-card flex items-center gap-3 border-t px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="h-12 flex-1 font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 flex-2 font-semibold"
            data-testid="confirm-stock-update"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Check className="mr-2 h-5 w-5" />
            )}
            Update Stock
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
