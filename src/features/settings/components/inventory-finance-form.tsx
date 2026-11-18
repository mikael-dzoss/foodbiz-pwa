"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
  Lock,
} from "lucide-react";
import type { BusinessSettings } from "@/domain/business";
import type { SettingsDictionary } from "@/domain/i18n";
import { SoonBadge } from "@/components/feedback";
import { ActionBar, Button, Field, Input, useToast } from "@/components/ui";
import { updateInventoryFinanceSettingsAction } from "../actions";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";

export interface InventoryFinanceFormProps {
  settings: BusinessSettings;
  dict: SettingsDictionary;
}

export function InventoryFinanceForm({ settings, dict }: InventoryFinanceFormProps) {
  const { showToast, showError } = useToast();
  const { locale: managerLocale, dict: managerDict } = useManagerLocale();
  const x = managerDict.settingsExtra;
  type SaveResult = Awaited<ReturnType<typeof updateInventoryFinanceSettingsAction>> | null;
  const [dismissed, setDismissed] = useState<SaveResult>(null);

  // 1. Inventory controls
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(
    settings.lowStockThreshold ?? 5,
  );

  // 2. Finance controls
  const [taxPercentage, setTaxPercentage] = useState<number>(settings.taxPercentage ?? 0);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat ?? "DD/MM/YYYY");

  // Errors

  const handleDiscard = () => {
    setLowStockThreshold(settings.lowStockThreshold ?? 5);
    setTaxPercentage(settings.taxPercentage ?? 0);
    setDateFormat(settings.dateFormat ?? "DD/MM/YYYY");
    setDismissed(result);
    showToast(x.discarded);
  };

  const [result, formAction, isPending] = useActionState(async (): Promise<SaveResult> => {
    const res = await updateInventoryFinanceSettingsAction({
      lowStockThreshold: Number(lowStockThreshold),
      taxPercentage: Number(taxPercentage),
      currency: "EUR" as const,
      dateFormat,
    });

    if (res.ok) {
      showToast(dict.inventoryFinance.saveSuccess);
    } else {
      showError(actionErrorMessage(res, managerLocale));
    }
    return res;
  }, null);
  const errors: Record<string, string[]> =
    result && result !== dismissed && !result.ok ? (result.fieldErrors ?? {}) : {};

  return (
    <form
      action={formAction}
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
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-title-lg text-foreground">{dict.inventoryFinance.title}</h1>
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
          <Field
            id="low-stock-threshold-input"
            label={
              <span className="inline-flex items-center gap-2">
                <Package className="text-primary h-4 w-4" />
                {dict.inventoryFinance.lowStockLabel}
              </span>
            }
            hint={dict.inventoryFinance.lowStockHelper}
            hintPosition="above"
            error={errors.lowStockThreshold?.[0]}
          >
            <Input
              data-testid="input-low-stock-threshold"
              type="number"
              min="0"
              step="1"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value, 10) || 0)}
              className="h-11 rounded-xl px-3 py-2 font-mono text-sm"
            />
          </Field>

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
                    {x.soon.categoriesReorder}
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
              <span>{x.euro}</span>
              <span className="text-muted-foreground font-mono text-xs">{x.isoLine}</span>
            </div>
          </div>

          {/* Tax Percentage */}
          <Field
            id="tax-percentage-input"
            label={
              <span className="inline-flex items-center gap-2">
                <Receipt className="text-primary h-4 w-4" />
                {dict.inventoryFinance.taxLabel}
              </span>
            }
            hint={dict.inventoryFinance.taxHelper}
            hintPosition="above"
            error={errors.taxPercentage?.[0]}
            className="border-border border-t pt-3"
          >
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  data-testid="input-tax-percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxPercentage}
                  onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                  className="h-11 rounded-xl py-2 pr-8 pl-3 font-mono text-sm"
                />
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm font-medium">
                  %
                </span>
              </div>
            )}
          </Field>
        </div>
      </div>

      {/* Section 3: Upcoming Capabilities */}
      <div className="mb-6">
        <h2 className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase">
          {dict.inventoryFinance.soonSection}
        </h2>
        <div className="border-border bg-card divide-border divide-y rounded-2xl border shadow-2xs">
          {/* Change Currency */}
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <span className="text-foreground block text-sm font-medium">
                  {x.soon.multiCurrencyTitle}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {x.soon.multiCurrencyDesc}
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
                  {x.soon.customTagsTitle}
                </span>
                <span className="text-muted-foreground block text-xs">{x.soon.customTagsDesc}</span>
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
                  {x.soon.csvExportTitle}
                </span>
                <span className="text-muted-foreground block text-xs">{x.soon.csvExportDesc}</span>
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
                  {x.soon.sizesComboTitle}
                </span>
                <span className="text-muted-foreground block text-xs">{x.soon.sizesComboDesc}</span>
              </div>
            </div>
            {/* TODO(catalog): wire product size variants (#73) */}
            <SoonBadge />
          </div>
        </div>
      </div>

      {/* Sticky Save/Discard bar: above the manager bottom nav, static on desktop */}
      <ActionBar data-testid="settings-action-bar">
        <Button
          type="button"
          variant="outline"
          onClick={handleDiscard}
          disabled={isPending}
          data-testid="discard-button"
          className="flex-1 rounded-xl"
        >
          {dict.inventoryFinance.discardButton}
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          loading={isPending}
          data-testid="save-inventory-finance-button"
          className="flex-1 rounded-xl"
        >
          {isPending ? dict.saving : dict.inventoryFinance.saveButton}
        </Button>
      </ActionBar>
    </form>
  );
}
