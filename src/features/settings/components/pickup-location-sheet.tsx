"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import { getDictionary, interpolate, type SupportedLocale } from "@/domain/i18n";
import { formatMoney } from "@/domain/formatting/money";
import {
  MAX_PICKUP_FEE_CENTS,
  createPickupLocationSchema,
  type PickupLocation,
} from "@/domain/pickup-location";
import {
  Alert,
  Button,
  Field,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
} from "@/components/ui";
import { HoursSummary } from "./opening-hours";

/** Fields the sheet edits; hours live on their own sub-page. */
export interface PickupLocationFormValue {
  name: string;
  description: string | null;
  address: string;
  postcode: string;
  feeCents: number;
  isActive: boolean;
}

interface Draft {
  name: string;
  description: string;
  address: string;
  postcode: string;
  feeEuros: string;
  isActive: boolean;
}

type DraftErrors = Partial<Record<"name" | "address" | "postcode" | "fee", string>>;

type Labels = ReturnType<typeof getDictionary>["settings"]["pickupLocations"];

function initialDraft(location: PickupLocation | null, locale: SupportedLocale): Draft {
  return {
    name: location?.name ?? "",
    description: location?.description ?? "",
    address: location?.address ?? "",
    postcode: location?.postcode ?? "",
    feeEuros: ((location?.feeCents ?? 0) / 100).toLocaleString(
      locale === "fr" ? "fr-FR" : "en-US",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      },
    ),
    isActive: location?.isActive ?? true,
  };
}

/** Euro text ("2,50" or "2.5") to cents, or `null` when it is not a valid amount. */
function parseFeeCents(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (normalized === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Validates the draft with the domain schema and maps issues to localized field messages. */
export function validatePickupDraft(
  draft: Draft,
  t: Labels,
  locale: SupportedLocale,
): { errors: DraftErrors; value: PickupLocationFormValue | null } {
  const errors: DraftErrors = {};
  const feeCents = parseFeeCents(draft.feeEuros);
  const maxFee = formatMoney(MAX_PICKUP_FEE_CENTS, locale);
  if (feeCents === null || feeCents > MAX_PICKUP_FEE_CENTS) {
    errors.fee = interpolate(t.errorFee, { max: maxFee });
  }

  const parsed = createPickupLocationSchema.safeParse({
    name: draft.name,
    description: draft.description.trim() === "" ? null : draft.description,
    address: draft.address,
    postcode: draft.postcode,
    feeCents: feeCents ?? 0,
    isActive: draft.isActive,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "name") errors.name ??= t.errorName;
      else if (field === "address") errors.address ??= t.errorAddress;
      else if (field === "postcode") errors.postcode ??= t.errorPostcode;
    }
  }
  if (!parsed.success || Object.keys(errors).length > 0) return { errors, value: null };

  const { name, description, address, postcode, feeCents: fee, isActive } = parsed.data;
  return { errors, value: { name, description, address, postcode, feeCents: fee, isActive } };
}

interface FormProps {
  location: PickupLocation | null;
  locale: SupportedLocale;
  busy: boolean;
  submitError: string | null;
  onSave: (value: PickupLocationFormValue) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function PickupLocationForm({
  location,
  locale,
  busy,
  submitError,
  onSave,
  onCancel,
  onDelete,
}: FormProps) {
  const dict = getDictionary(locale).settings;
  const t = dict.pickupLocations;
  const oh = dict.openingHours;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(location, locale));
  const [submitted, setSubmitted] = useState(false);
  const { errors, value } = useMemo(
    () => validatePickupDraft(draft, t, locale),
    [draft, t, locale],
  );
  const show = (message?: string) => (submitted ? message : undefined);
  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!value) {
      const form = event.currentTarget;
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    onSave(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 space-y-4"
      data-testid="pickup-location-form"
    >
      <Field label={t.nameLabel} error={show(errors.name)} required>
        <Input
          value={draft.name}
          maxLength={80}
          disabled={busy}
          data-testid="pickup-location-name"
          onChange={(e) => patch({ name: e.target.value })}
        />
      </Field>
      <Field label={t.descriptionLabel}>
        <Textarea
          rows={2}
          value={draft.description}
          maxLength={200}
          disabled={busy}
          data-testid="pickup-location-description"
          className="min-h-0 rounded-xl py-2"
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>
      <Field label={t.addressLabel} error={show(errors.address)} required>
        <Input
          value={draft.address}
          maxLength={200}
          disabled={busy}
          autoComplete="street-address"
          data-testid="pickup-location-address"
          onChange={(e) => patch({ address: e.target.value })}
        />
      </Field>
      <div className="xs:grid-cols-2 grid grid-cols-1 gap-4">
        <Field label={t.postcodeLabel} error={show(errors.postcode)} hint={t.postcodeHint} required>
          <Input
            value={draft.postcode}
            inputMode="numeric"
            maxLength={5}
            disabled={busy}
            autoComplete="postal-code"
            data-testid="pickup-location-postcode"
            onChange={(e) => patch({ postcode: e.target.value })}
          />
        </Field>
        <Field label={t.feeLabel} error={show(errors.fee)} hint={t.feeHint}>
          <Input
            value={draft.feeEuros}
            inputMode="decimal"
            disabled={busy}
            data-testid="pickup-location-fee"
            className="tabular-nums"
            onChange={(e) => patch({ feeEuros: e.target.value })}
          />
        </Field>
      </div>

      <div className="border-border flex items-center justify-between gap-4 rounded-xl border p-3">
        <div className="min-w-0">
          <span className="text-label-md text-foreground block">{t.activeLabel}</span>
          <span className="text-body-sm text-muted-foreground block">{t.activeHint}</span>
        </div>
        <Switch
          checked={draft.isActive}
          onCheckedChange={(isActive) => patch({ isActive })}
          disabled={busy}
          aria-label={t.activeLabel}
          data-testid="pickup-location-active"
        />
      </div>

      <div role="group" aria-labelledby="pickup-location-hours-heading" className="space-y-2">
        <span
          id="pickup-location-hours-heading"
          className="text-label-sm text-muted-foreground block tracking-wider uppercase"
        >
          {t.hoursSection}
        </span>
        <div className="border-border rounded-xl border p-3" data-testid="pickup-location-hours">
          {location?.weeklyHours ? (
            <HoursSummary
              weekly={location.weeklyHours}
              showExceptions={false}
              locale={locale}
              labels={{ closed: oh.closed }}
              data-testid="pickup-location-hours-summary"
            />
          ) : (
            <p
              className="text-body-sm text-muted-foreground"
              data-testid="pickup-location-hours-shop"
            >
              {t.sameAsShopHours}
            </p>
          )}
        </div>
        {location ? (
          <Link
            href={`/manage/settings/pickup-locations/${location.id}/hours`}
            data-testid="pickup-location-edit-hours"
            className="hover:bg-muted/50 active:bg-muted focus-visible:ring-ring border-border flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="flex items-center gap-2.5">
              <Clock className="text-muted-foreground h-4 w-4" aria-hidden="true" />
              <span className="text-label-md text-foreground">{t.editHoursRow}</span>
            </span>
            <ChevronRight className="text-muted-foreground/60 h-5 w-5" aria-hidden="true" />
          </Link>
        ) : (
          <p
            className="text-body-sm text-muted-foreground"
            data-testid="pickup-location-hours-hint"
          >
            {t.editHoursNewHint}
          </p>
        )}
      </div>

      {submitError && (
        <Alert tone="error" data-testid="pickup-location-form-error" tabIndex={-1}>
          {submitError}
        </Alert>
      )}

      <SheetFooter>
        <Button
          type="submit"
          loading={busy}
          disabled={busy}
          data-testid="pickup-location-save"
          className="min-h-11 rounded-xl"
        >
          {t.saveButton}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          data-testid="pickup-location-cancel"
          className="min-h-11 rounded-xl"
        >
          {t.cancelButton}
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={busy}
            data-testid="pickup-location-delete"
            className="min-h-11 rounded-xl"
          >
            {t.deleteButton}
          </Button>
        )}
      </SheetFooter>
    </form>
  );
}

export interface PickupLocationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Location being edited, or `null` to add a new one. */
  location: PickupLocation | null;
  locale: SupportedLocale;
  busy?: boolean;
  submitError?: string | null;
  onSave: (value: PickupLocationFormValue) => void;
  onDelete?: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}

/** Modal sheet to add or edit one relay pickup location (#385). Hours are edited on a sub-page. */
export function PickupLocationSheet({
  open,
  onOpenChange,
  location,
  locale,
  busy = false,
  submitError = null,
  onSave,
  onDelete,
  onCloseAutoFocus,
}: PickupLocationSheetProps) {
  const t = getDictionary(locale).settings.pickupLocations;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl"
        data-testid="pickup-location-sheet"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader>
          <SheetTitle>{location ? t.sheetEditTitle : t.sheetAddTitle}</SheetTitle>
          <SheetDescription>{t.sheetDescription}</SheetDescription>
        </SheetHeader>
        {open && (
          <PickupLocationForm
            key={location ? location.id : "new"}
            location={location}
            locale={locale}
            busy={busy}
            submitError={submitError}
            onSave={onSave}
            onCancel={() => onOpenChange(false)}
            onDelete={location ? onDelete : undefined}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
