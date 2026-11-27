"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Clock,
  MapPin,
  Plus,
  Store,
} from "lucide-react";
import { getDictionary, interpolate, type SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting/money";
import { groupWeeklyHours } from "@/domain/opening-hours";
import { MAX_PICKUP_LOCATIONS, type PickupLocation } from "@/domain/pickup-location";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { EmptyState } from "@/components/feedback";
import { Alert, Badge, Button, ConfirmDialog, Switch, useToastOptional } from "@/components/ui";
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
  /** `service_types.pickup` from the ordering settings; locations are not offered when off. */
  pickupServiceEnabled?: boolean;
  initial: readonly PickupLocation[];
  locale: SupportedLocale;
}

type FocusTarget =
  | { type: "add" }
  | { type: "shop" }
  | { type: "formError" }
  | { type: "move"; id: string; dir: "up" | "down" };

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
  pickupServiceEnabled = true,
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
  const [shopError, setShopError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const shopSwitchRef = useRef<HTMLButtonElement>(null);
  const moveRefs = useRef(new Map<string, HTMLButtonElement>());
  const refocusAddOnClose = useRef(false);

  // Runs after the commit; the short delay lets Radix finish returning focus to its own trigger first.
  useEffect(() => {
    if (!focusTarget) return;
    setTimeout(() => {
      const element =
        focusTarget.type === "add"
          ? addRef.current
          : focusTarget.type === "shop"
            ? shopSwitchRef.current
            : focusTarget.type === "move"
              ? moveRefs.current.get(`${focusTarget.id}:${focusTarget.dir}`)
              : document.querySelector<HTMLElement>('[data-testid="pickup-location-form-error"]');
      element?.focus();
    }, 50);
  }, [focusTarget]);

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
        if (editing) setSheetOpen(false);
        else setEditing(saved); // stay open in edit mode so "Edit hours" is reachable
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
        refocusAddOnClose.current = true;
        setSheetOpen(false);
        setFocusTarget({ type: "add" });
      } else {
        const message = actionErrorMessage(res, locale);
        setSubmitError(message);
        toast?.showError(message);
        setFocusTarget({ type: "formError" });
      }
      // Always close the dialog so a refusal (inline error in the sheet, toast) stays visible.
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (busy || target < 0 || target >= locations.length) return;
    const moved = locations[index];
    const next = locations.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setPageError(null);
    try {
      const res = await reorderPickupLocationsAction({ ids: next.map((l) => l.id) });
      if (res.ok) {
        setLocations(res.data);
        setAnnouncement(
          interpolate(t.movedAnnouncement, {
            name: moved.name,
            n: String(target + 1),
            total: String(locations.length),
          }),
        );
        // Keep focus on the same direction, or the opposite one when the row hit the list edge.
        const atEdge = offset === -1 ? target === 0 : target === locations.length - 1;
        setFocusTarget({
          type: "move",
          id: moved.id,
          dir: atEdge ? (offset === -1 ? "down" : "up") : offset === -1 ? "up" : "down",
        });
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
    setShopError(null);
    setBusy(true);
    try {
      const res = await setShopPickupEnabledAction({ enabled });
      if (!res.ok) {
        // Refused (e.g. LAST_PICKUP_OPTION): put the switch back and say why.
        setShopEnabled(previous);
        const message = actionErrorMessage(res, locale);
        setShopError(message);
        toast?.showError(message);
        setFocusTarget({ type: "shop" });
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
          ref={addRef}
          type="button"
          onClick={openAdd}
          disabled={limitReached}
          aria-describedby={limitReached ? "pickup-locations-limit" : undefined}
          data-testid="pickup-location-add"
          className="min-h-11 shrink-0 rounded-xl"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{t.addButton}</span>
        </Button>
      </div>

      {limitReached && (
        <p
          id="pickup-locations-limit"
          data-testid="pickup-locations-limit"
          className="text-body-sm text-muted-foreground -mt-3 mb-4"
        >
          {interpolate(t.limitHint, { max: String(MAX_PICKUP_LOCATIONS) })}
        </p>
      )}

      {!pickupServiceEnabled && (
        <Alert tone="warning" data-testid="pickup-service-off-notice" className="mb-4">
          {t.pickupOffNotice}{" "}
          <Link
            href="/manage/settings/ordering"
            data-testid="pickup-service-off-ordering-link"
            className="focus-visible:ring-ring font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:outline-none"
          >
            {dict.ordering.title}
          </Link>
        </Alert>
      )}

      <p role="status" className="sr-only" data-testid="pickup-locations-announcement">
        {announcement}
      </p>

      {pageError && (
        <Alert tone="error" data-testid="pickup-locations-error" className="mb-4">
          {pageError}
        </Alert>
      )}

      <ul
        data-testid="pickup-shop-list"
        className="border-border bg-card overflow-hidden rounded-2xl border shadow-2xs"
      >
        <li data-testid="pickup-shop-row" className="flex flex-wrap items-center gap-3 p-4">
          <div className="bg-primary-soft text-primary-soft-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Store className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-label-md text-foreground line-clamp-2 block">
              {interpolate(t.shopName, { name: shop.name })}
            </span>
            <span className="text-body-sm text-muted-foreground line-clamp-2 block">
              {shop.address ? `${t.shopHint} · ${shop.address}` : t.shopHint}
            </span>
          </div>
          <Switch
            ref={shopSwitchRef}
            checked={shopEnabled}
            onCheckedChange={handleShopToggle}
            disabled={busy}
            aria-label={t.shopPickupLabel}
            aria-describedby={shopError ? "pickup-shop-error" : undefined}
            data-testid="switch-shop-pickup"
          />
          {shopError && (
            <p
              id="pickup-shop-error"
              role="alert"
              data-testid="pickup-shop-error"
              className="text-destructive flex basis-full items-start gap-2 text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{shopError}</span>
            </p>
          )}
        </li>
      </ul>

      <h2 className="text-label-sm text-muted-foreground mt-6 mb-2 px-1 tracking-wider uppercase">
        {t.relaySection}
      </h2>

      <ul
        data-testid="pickup-locations-list"
        className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-2xs empty:hidden"
      >
        {locations.map((location, index) => {
          const hours = compactHours(location, locale, dict.openingHours.closed);
          const isFree = location.feeCents === 0;
          return (
            <li
              key={location.id}
              data-testid={`pickup-location-row-${location.id}`}
              className="flex items-stretch"
            >
              <Button
                type="button"
                variant="unstyled"
                size="none"
                onClick={() => openEdit(location)}
                aria-label={interpolate(t.editAria, { name: location.name })}
                data-testid={`pickup-location-edit-${location.id}`}
                className="hover:bg-muted/50 active:bg-muted flex min-h-14 min-w-0 flex-1 flex-col gap-1 p-4 text-left focus-visible:ring-offset-0 focus-visible:ring-inset"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "text-label-md line-clamp-2",
                      location.isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {location.name}
                  </span>
                  <Badge
                    variant={isFree ? "success" : "completed"}
                    data-testid={`pickup-location-fee-${location.id}`}
                    className={cn("shrink-0 tabular-nums", !isFree && "text-foreground")}
                  >
                    {isFree ? t.free : formatMoney(location.feeCents, locale)}
                  </Badge>
                  {!location.isActive && (
                    <Badge
                      variant="outline"
                      data-testid={`pickup-location-inactive-${location.id}`}
                    >
                      {t.inactive}
                    </Badge>
                  )}
                </span>
                <span className="text-body-sm text-muted-foreground flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    {location.address}, {location.postcode}
                  </span>
                </span>
                <span className="text-body-sm text-muted-foreground flex items-start gap-1.5 tabular-nums">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span data-testid={`pickup-location-hours-${location.id}`} className="min-w-0">
                    {hours ?? t.sameAsShopHours}
                  </span>
                </span>
              </Button>
              <div className="flex shrink-0 flex-col justify-center pr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  ref={(el) => {
                    if (el) moveRefs.current.set(`${location.id}:up`, el);
                    else moveRefs.current.delete(`${location.id}:up`);
                  }}
                  disabled={index === 0}
                  aria-disabled={busy || undefined}
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
                  ref={(el) => {
                    if (el) moveRefs.current.set(`${location.id}:down`, el);
                    else moveRefs.current.delete(`${location.id}:down`);
                  }}
                  disabled={index === locations.length - 1}
                  aria-disabled={busy || undefined}
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
        <EmptyState
          icon={<MapPin className="h-6 w-6" aria-hidden="true" />}
          title={t.emptyTitle}
          description={t.emptyHint}
          className="mt-4 rounded-2xl"
          data-testid="pickup-locations-empty"
        />
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
        onCloseAutoFocus={(event) => {
          if (!refocusAddOnClose.current) return;
          refocusAddOnClose.current = false;
          event.preventDefault();
          addRef.current?.focus();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        destructive
        loading={busy}
        title={interpolate(t.deleteConfirmTitle, { name: editing?.name ?? "" })}
        description={t.deleteConfirmDescription}
        cancelLabel={t.cancelButton}
        confirmLabel={t.deleteButton}
        onConfirm={handleDelete}
        data-testid="pickup-location-delete-dialog"
      />
    </div>
  );
}
