"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDown, ArrowUp, ChevronLeft, MapPin, Plus, Store } from "lucide-react";
import { getDictionary, interpolate, type SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting/money";
import { groupWeeklyHours } from "@/domain/opening-hours";
import { MAX_PICKUP_LOCATIONS, type PickupLocation } from "@/domain/pickup-location";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { Badge, Button, ConfirmDialog, Switch, useToastOptional } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  createPickupLocationAction,
  deletePickupLocationAction,
  reorderPickupLocationsAction,
  setShopPickupEnabledAction,
  updatePickupLocationAction,
} from "../pickup-location-actions";
import { PickupLocationSheet, type PickupLocationFormValue } from "./pickup-location-sheet";

export interface PickupLocationsSettingsProps {
  shop: { name: string; address: string | null };
  shopPickupEnabled: boolean;
  initial: readonly PickupLocation[];
  locale: SupportedLocale;
}

/** "Mon–Fri 09:00–17:00 · Sat 10:00–12:00", skipping closed days; null when no hours of its own. */
function compactHours(
  location: PickupLocation,
  locale: SupportedLocale,
  closedLabel: string,
): string | null {
  if (!location.weeklyHours) return null;
  const open = groupWeeklyHours(location.weeklyHours, locale).filter(
    (group) => !group.closed && group.ranges.length > 0,
  );
  if (open.length === 0) return closedLabel;
  return open.map((group) => `${group.label} ${group.ranges.join(", ")}`).join(" · ");
}

/** Pickup locations list (#385): shop row with pickup switch, relay rows, add/edit sheet. */
export function PickupLocationsSettings({
  shop,
  shopPickupEnabled,
  initial,
  locale,
}: PickupLocationsSettingsProps) {
  const dict = getDictionary(locale).settings;
  const t = dict.pickupLocations;
  const toast = useToastOptional();

  const [locations, setLocations] = useState<readonly PickupLocation[]>(initial);
  const [shopEnabled, setShopEnabled] = useState(shopPickupEnabled);
  const [pageError, setPageError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<PickupLocation | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const limitReached = locations.length >= MAX_PICKUP_LOCATIONS;

  const openAdd = () => {
    setEditing(null);
    setSubmitError(null);
    setSheetOpen(true);
  };

  const openEdit = (location: PickupLocation) => {
    setEditing(location);
    setSubmitError(null);
    setSheetOpen(true);
  };

  const handleSave = async (value: PickupLocationFormValue) => {
    setBusy(true);
    setSubmitError(null);
    try {
      const res = editing
        ? await updatePickupLocationAction({ id: editing.id, ...value })
        : await createPickupLocationAction(value);
      if (res.ok) {
        const saved = res.data;
        setLocations((prev) =>
          editing ? prev.map((l) => (l.id === saved.id ? saved : l)) : [...prev, saved],
        );
        toast?.showToast(t.saveSuccess);
        setSheetOpen(false);
        return;
      }
      const message = actionErrorMessage(res, locale);
      setSubmitError(message);
      toast?.showError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const res = await deletePickupLocationAction({ id: editing.id });
      if (res.ok) {
        setLocations((prev) => prev.filter((l) => l.id !== editing.id));
        toast?.showToast(t.deleteSuccess);
        setSheetOpen(false);
      } else {
        const message = actionErrorMessage(res, locale);
        setSubmitError(message);
        toast?.showError(message);
      }
      // Always close the dialog so a refusal (inline error in the sheet, toast) stays visible.
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= locations.length) return;
    const next = locations.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setPageError(null);
    try {
      const res = await reorderPickupLocationsAction({ ids: next.map((l) => l.id) });
      if (res.ok) {
        setLocations(res.data);
      } else {
        const message = actionErrorMessage(res, locale);
        setPageError(message);
        toast?.showError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleShopToggle = async (enabled: boolean) => {
    const previous = shopEnabled;
    setShopEnabled(enabled);
    setPageError(null);
    setBusy(true);
    try {
      const res = await setShopPickupEnabledAction({ enabled });
      if (!res.ok) {
        // Refused (e.g. LAST_PICKUP_OPTION): put the switch back and say why.
        setShopEnabled(previous);
        const message = actionErrorMessage(res, locale);
        setPageError(message);
        toast?.showError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-md px-4 py-6 pb-24"
      data-testid="pickup-locations-settings"
    >
      <div className="mb-6 flex items-center">
        <Link
          href="/manage/settings/ordering"
          data-testid="back-to-ordering"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          <span>{dict.ordering.title}</span>
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title-lg text-foreground">{t.title}</h1>
          <p className="text-body-sm text-muted-foreground mt-1">{t.description}</p>
        </div>
        <Button
          type="button"
          onClick={openAdd}
          disabled={limitReached}
          data-testid="pickup-location-add"
          className="min-h-11 shrink-0 rounded-xl"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{t.addButton}</span>
        </Button>
      </div>

      {pageError && (
        <div
          role="alert"
          data-testid="pickup-locations-error"
          className="border-destructive/40 bg-destructive/10 text-destructive mb-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{pageError}</span>
        </div>
      )}

      <ul
        data-testid="pickup-locations-list"
        className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-2xs"
      >
        <li data-testid="pickup-shop-row" className="flex items-center gap-3 p-4">
          <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Store className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-foreground block truncate text-sm font-semibold">
              {interpolate(t.shopName, { name: shop.name })}
            </span>
            <span className="text-body-sm text-muted-foreground block truncate">
              {shop.address ? `${t.shopHint} · ${shop.address}` : t.shopHint}
            </span>
          </div>
          <Switch
            checked={shopEnabled}
            onCheckedChange={handleShopToggle}
            disabled={busy}
            aria-label={t.shopPickupLabel}
            data-testid="switch-shop-pickup"
          />
        </li>

        {locations.map((location, index) => {
          const hours = compactHours(location, locale, dict.openingHours.closed);
          return (
            <li
              key={location.id}
              data-testid={`pickup-location-row-${location.id}`}
              className={cn("flex items-stretch", !location.isActive && "opacity-80")}
            >
              <button
                type="button"
                onClick={() => openEdit(location)}
                aria-label={interpolate(t.editAria, { name: location.name })}
                data-testid={`pickup-location-edit-${location.id}`}
                className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 min-w-0 flex-1 items-start gap-3 p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-foreground truncate text-sm font-semibold">
                      {location.name}
                    </span>
                    {!location.isActive && (
                      <Badge
                        variant="completed"
                        data-testid={`pickup-location-inactive-${location.id}`}
                      >
                        {t.inactive}
                      </Badge>
                    )}
                  </span>
                  <span className="text-body-sm text-muted-foreground block">
                    {location.address}, {location.postcode}
                  </span>
                  <span className="text-body-sm text-muted-foreground block tabular-nums">
                    <span data-testid={`pickup-location-fee-${location.id}`}>
                      {location.feeCents === 0 ? t.free : formatMoney(location.feeCents, locale)}
                    </span>
                    {" · "}
                    <span data-testid={`pickup-location-hours-${location.id}`}>
                      {hours ?? t.sameAsShopHours}
                    </span>
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 flex-col justify-center pr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy || index === 0}
                  onClick={() => handleMove(index, -1)}
                  aria-label={interpolate(t.moveUpAria, { name: location.name })}
                  data-testid={`pickup-location-up-${location.id}`}
                  className="min-h-9 min-w-9"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy || index === locations.length - 1}
                  onClick={() => handleMove(index, 1)}
                  aria-label={interpolate(t.moveDownAria, { name: location.name })}
                  data-testid={`pickup-location-down-${location.id}`}
                  className="min-h-9 min-w-9"
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {locations.length === 0 && (
        <div
          data-testid="pickup-locations-empty"
          className="border-border bg-card mt-4 flex flex-col items-center gap-2 rounded-2xl border p-6 text-center"
        >
          <MapPin className="text-muted-foreground h-6 w-6" aria-hidden="true" />
          <p className="text-label-md text-foreground">{t.emptyTitle}</p>
          <p className="text-body-sm text-muted-foreground">{t.emptyHint}</p>
        </div>
      )}

      <PickupLocationSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        location={editing}
        locale={locale}
        busy={busy}
        submitError={submitError}
        onSave={handleSave}
        onDelete={() => setDeleteOpen(true)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        destructive
        loading={busy}
        title={t.deleteConfirmTitle}
        description={t.deleteConfirmDescription}
        cancelLabel={t.cancelButton}
        confirmLabel={t.deleteButton}
        onConfirm={handleDelete}
        data-testid="pickup-location-delete-dialog"
      />
    </div>
  );
}
