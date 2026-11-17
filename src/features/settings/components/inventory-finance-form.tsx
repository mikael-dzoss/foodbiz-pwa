"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Layers,
  Coins,
  Receipt,
  FileSpreadsheet,
  Upload,
  Globe,
  Tag,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonBadge } from "@/components/feedback";
import { useToast } from "@/components/ui";
import { updateInventoryFinanceSettingsAction } from "../actions";
import { actionErrorMessage } from "@/lib/actions/error-message";

export interface InventoryFinanceFormProps {
  settings: BusinessSettings;
  dict: SettingsDictionary;
}

export function InventoryFinanceForm({ settings, dict }: InventoryFinanceFormProps) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  // 1. Inventory controls
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(
    settings.lowStockThreshold ?? 5,
  );

  // 2. Finance controls
  const [taxPercentage, setTaxPercentage] = useState<number>(settings.taxPercentage ?? 0);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat ?? "DD/MM/YYYY");

  // Errors
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleDiscard = () => {
    setLowStockThreshold(settings.lowStockThreshold ?? 5);
    setTaxPercentage(settings.taxPercentage ?? 0);
    setDateFormat(settings.dateFormat ?? "DD/MM/YYYY");
    setErrors({});
    showToast("Changes discarded");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const res = await updateInventoryFinanceSettingsAction({
        lowStockThreshold: Number(lowStockThreshold),
        taxPercentage: Number(taxPercentage),
        currency: "EUR" as const,
        dateFormat,
      });

      if (res.ok) {
        showToast(dict.inventoryFinance.saveSuccess);
      } else {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        showToast(actionErrorMessage(res));
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md px-4 py-6 pb-32"
      data-testid="inventory-finance-form"
    >
      {/* Top Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/manage/settings"
          data-testid="back-to-settings"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>{dict.title}</span>
        </Link>
        <span className="text-muted-foreground bg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          M-65
        </span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-title-lg text-foreground font-bold tracking-tight">
          {dict.inventoryFinance.title}
        </h1>
        <p className="text-body-sm text-muted-foreground mt-1">
          {dict.inventoryFinance.description}
        </p>
      </div>

      {/* Section 1: Inventory Controls */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.inventoryFinance.inventorySection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-4 shadow-2xs">
          {/* Low-stock Threshold */}
          <div>
            <div className="flex items-center gap-2">
              <Package className="text-primary h-4 w-4" />
              <label
                htmlFor="low-stock-threshold-input"
                className="text-foreground text-sm font-semibold"
              >
                {dict.inventoryFinance.lowStockLabel}
              </label>
            </div>
            <p className="text-body-sm text-muted-foreground mt-0.5">
              {dict.inventoryFinance.lowStockHelper}
            </p>
            <input
              id="low-stock-threshold-input"
              data-testid="input-low-stock-threshold"
              type="number"
              min="0"
              step="1"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value, 10) || 0)}
              className="border-input bg-background text-foreground focus-visible:ring-ring mt-2 w-full rounded-xl border px-3 py-2 font-mono text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            />
            {errors.lowStockThreshold && (
              <p className="text-destructive mt-1 flex items-center gap-1 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.lowStockThreshold[0]}</span>
              </p>
            )}
          </div>

          {/* Link to Category Management */}
          <div className="border-border border-t pt-3">
            <Link
              href="/manage/categories"
              data-testid="link-manage-categories"
              className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring -mx-2 flex items-center justify-between rounded-xl p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary-soft text-primary-soft-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-foreground block text-sm font-semibold">
                    {dict.inventoryFinance.manageCategoriesButton}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Reorder and organize storefront menu categories
                  </span>
                </div>
              </div>
              <ChevronRight className="text-muted-foreground/60 h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Section 2: Financial Settings */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.inventoryFinance.financeSection}
        </h2>
        <div className="border-border bg-card space-y-4 rounded-2xl border p-4 shadow-2xs">
          {/* Currency (Read-only EUR) */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="text-secondary h-4 w-4" />
                <label className="text-foreground text-sm font-semibold">
                  {dict.inventoryFinance.currencyLabel}
                </label>
              </div>
              <span
                data-testid="badge-currency-readonly"
                className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium"
              >
                <Lock className="h-3 w-3" />
                <span>{dict.inventoryFinance.currencyReadOnlyBadge}</span>
              </span>
            </div>
            <p className="text-body-sm text-muted-foreground mt-0.5">
              {dict.inventoryFinance.currencyHelper}
            </p>
            <div className="bg-muted/40 border-border text-foreground mt-2 flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-medium">
              <span>Euro (€)</span>
              <span className="text-muted-foreground font-mono text-xs">ISO 4217: EUR</span>
            </div>
          </div>

          {/* Tax Percentage */}
          <div className="border-border border-t pt-3">
            <div className="flex items-center gap-2">
              <Receipt className="text-primary h-4 w-4" />
              <label
                htmlFor="tax-percentage-input"
                className="text-foreground text-sm font-semibold"
              >
                {dict.inventoryFinance.taxLabel}
              </label>
            </div>
            <p className="text-body-sm text-muted-foreground mt-0.5">
              {dict.inventoryFinance.taxHelper}
            </p>
            <div className="relative mt-2">
              <input
                id="tax-percentage-input"
                data-testid="input-tax-percentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                className="border-input bg-background text-foreground focus-visible:ring-ring w-full rounded-xl border py-2 pr-8 pl-3 font-mono text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              />
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-medium">
                %
              </span>
            </div>
            {errors.taxPercentage && (
              <p className="text-destructive mt-1 flex items-center gap-1 text-xs font-medium">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errors.taxPercentage[0]}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Upcoming Capabilities */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.inventoryFinance.soonSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border opacity-75 shadow-2xs">
          {/* Change Currency */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Multi-Currency Support
                </span>
                <span className="text-muted-foreground block text-xs">
                  Accept GBP, USD and Swiss Francs
                </span>
              </div>
            </div>
            {/* TODO(finance): wire multi-currency exchange rates (#73) */}
            <SoonBadge />
          </div>

          {/* Manage Expense Tags */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Tag className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Custom Expense Tags
                </span>
                <span className="text-muted-foreground block text-xs">
                  Create custom accounting allocation buckets
                </span>
              </div>
            </div>
            {/* TODO(expenses): wire dynamic custom expense tags (#73) */}
            <SoonBadge />
          </div>

          {/* CSV Import & Export */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  CSV Product & Order Export
                </span>
                <span className="text-muted-foreground block text-xs">
                  Spreadsheet dumps for accounting and inventory audits
                </span>
              </div>
            </div>
            {/* TODO(analytics): wire CSV accounting exporter (#73) */}
            <SoonBadge />
          </div>

          {/* Product Sizes & Menus */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Upload className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  Product Sizes & Combo Menus
                </span>
                <span className="text-muted-foreground block text-xs">
                  Variants, formulas and bundle pricing
                </span>
              </div>
            </div>
            {/* TODO(catalog): wire product size variants (#73) */}
            <SoonBadge />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isPending}
            data-testid="discard-button"
            className="border-border hover:bg-muted active:bg-muted/80 text-foreground focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {dict.inventoryFinance.discardButton}
          </button>
          <button
            type="submit"
            disabled={isPending}
            data-testid="save-inventory-finance-button"
            className="bg-primary hover:bg-primary/90 active:bg-primary/95 text-primary-foreground focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold shadow-2xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{dict.inventoryFinance.saveButton}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
