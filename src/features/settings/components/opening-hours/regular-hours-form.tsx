"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { getDictionary, type SupportedLocale } from "@/domain/i18n";
import { weeklyHoursSchema, type WeeklyHours } from "@/domain/opening-hours";
import { actionErrorMessage } from "@/lib/actions/error-message";
import type { ActionResult } from "@/lib/actions/types";
import { ActionBar, Button, ConfirmDialog, useToastOptional } from "@/components/ui";
import {
  WeeklyHoursEditor,
  cloneWeeklyHours,
  createDefaultWeeklyHours,
  type WeeklyHoursEditorLabels,
} from "./weekly-hours-editor";

export interface RegularHoursFormLabels {
  editor?: WeeklyHoursEditorLabels;
  saveButton: string;
  saving: string;
  discardButton: string;
  discardedToast: string;
  saveSuccess: string;
  errorFixBeforeSave: string;
  clearButton: string;
  clearConfirmTitle: string;
  clearConfirmDescription: string;
  clearConfirmAction: string;
  clearCancelAction: string;
  clearSuccess: string;
}

export interface RegularHoursFormProps {
  /** Stored weekly hours, or `null` when not yet configured. */
  initial: WeeklyHours | null;
  /** Caller-provided save handler (business settings action or pickup location action). */
  onSave: (hours: WeeklyHours) => Promise<ActionResult<unknown>>;
  /** Optional handler to clear structured hours back to `null` (shows a confirm dialog). */
  onClear?: () => Promise<ActionResult<unknown>>;
  /** Optional contextual note shown above the action bar (e.g. pickup point notice). */
  footerNote?: string;
  locale?: SupportedLocale;
  labels?: RegularHoursFormLabels;
  "data-testid"?: string;
}

function defaultFormLabels(locale: SupportedLocale): RegularHoursFormLabels {
  const dict = getDictionary(locale);
  const oh = dict.settings.openingHours;
  return {
    saveButton: oh.saveButton,
    saving: dict.settings.saving,
    discardButton: oh.discardButton,
    discardedToast: dict.settingsExtra.discarded,
    saveSuccess: oh.saveSuccess,
    errorFixBeforeSave: oh.errorFixBeforeSave,
    clearButton: oh.clearButton,
    clearConfirmTitle: oh.clearConfirmTitle,
    clearConfirmDescription: oh.clearConfirmDescription,
    clearConfirmAction: oh.clearConfirmAction,
    clearCancelAction: dict.common.cancel,
    clearSuccess: oh.clearSuccess,
  };
}

/**
 * Prop-driven regular weekly opening hours form (#372): combines `WeeklyHoursEditor`, sticky
 * `ActionBar`, optional `footerNote`, and optional destructive clear confirmation dialog.
 */
export function RegularHoursForm({
  initial,
  onSave,
  onClear,
  footerNote,
  locale = "en",
  labels: providedLabels,
  "data-testid": testId = "regular-hours-form",
}: RegularHoursFormProps) {
  const toast = useToastOptional();
  const labels = useMemo(
    () => providedLabels ?? defaultFormLabels(locale),
    [providedLabels, locale],
  );

  const [savedHours, setSavedHours] = useState<WeeklyHours | null>(() =>
    initial ? cloneWeeklyHours(initial) : null,
  );
  const [draft, setDraft] = useState<WeeklyHours>(() =>
    initial ? cloneWeeklyHours(initial) : createDefaultWeeklyHours(),
  );
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [, formAction, isPending] = useActionState(async (): Promise<null> => {
    const parsed = weeklyHoursSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError(labels.errorFixBeforeSave);
      toast?.showError(labels.errorFixBeforeSave);
      return null;
    }

    setFormError(null);
    const res = await onSave(parsed.data);
    if (res.ok) {
      setSavedHours(cloneWeeklyHours(parsed.data));
      toast?.showToast(labels.saveSuccess);
    } else {
      const message = actionErrorMessage(res, locale);
      setFormError(message);
      toast?.showError(message);
    }
    return null;
  }, null);

  const handleDraftChange = (next: WeeklyHours) => {
    setDraft(next);
    if (formError) setFormError(null);
  };

  const handleDiscard = () => {
    setDraft(savedHours ? cloneWeeklyHours(savedHours) : createDefaultWeeklyHours());
    setFormError(null);
    setEditorResetKey((key) => key + 1);
    toast?.showToast(labels.discardedToast);
  };

  const handleConfirmClear = async () => {
    if (!onClear) return;
    setIsClearing(true);
    setFormError(null);
    try {
      const res = await onClear();
      if (res.ok) {
        setSavedHours(null);
        setClearDialogOpen(false);
        toast?.showToast(labels.clearSuccess);
      } else {
        const message = actionErrorMessage(res, locale);
        setFormError(message);
        toast?.showError(message);
      }
    } finally {
      setIsClearing(false);
    }
  };

  const busy = isPending || isClearing;

  return (
    <>
      <form action={formAction} className="space-y-6" data-testid={testId}>
        {formError && (
          <div
            role="alert"
            data-testid={`${testId}-error`}
            className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <WeeklyHoursEditor
          key={editorResetKey}
          value={draft}
          onChange={handleDraftChange}
          locale={locale}
          labels={labels.editor}
          disabled={busy}
        />

        {footerNote && (
          <div
            data-testid="regular-hours-footer-note"
            className="border-border bg-muted/50 text-body-sm text-muted-foreground flex items-start gap-2.5 rounded-xl border px-3.5 py-3"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{footerNote}</p>
          </div>
        )}

        {onClear && savedHours !== null && (
          <div className="border-border border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearDialogOpen(true)}
              disabled={busy}
              data-testid="clear-structured-hours-button"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 active:bg-destructive/20 w-full rounded-xl"
            >
              {labels.clearButton}
            </Button>
          </div>
        )}

        <ActionBar data-testid="settings-action-bar">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={busy}
            data-testid="discard-button"
            className="flex-1 rounded-xl"
          >
            {labels.discardButton}
          </Button>
          <Button
            type="submit"
            disabled={busy}
            loading={isPending}
            data-testid="save-regular-hours-button"
            className="flex-1 rounded-xl"
          >
            {isPending ? labels.saving : labels.saveButton}
          </Button>
        </ActionBar>
      </form>

      {onClear && (
        <ConfirmDialog
          open={clearDialogOpen}
          onOpenChange={setClearDialogOpen}
          destructive
          loading={isClearing}
          title={labels.clearConfirmTitle}
          description={labels.clearConfirmDescription}
          cancelLabel={labels.clearCancelAction}
          confirmLabel={labels.clearConfirmAction}
          onConfirm={handleConfirmClear}
          data-testid="clear-hours-confirm-dialog"
        />
      )}
    </>
  );
}
