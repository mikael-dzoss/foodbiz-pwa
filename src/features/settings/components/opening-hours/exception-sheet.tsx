"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { getDictionary, interpolate, type SupportedLocale } from "@/domain/i18n";
import {
  MAX_EXCEPTION_NOTE_LENGTH,
  MAX_EXCEPTION_SPAN_DAYS,
  MAX_RANGES_PER_DAY,
  hoursExceptionsSchema,
  type HoursException,
  type TimeRange,
} from "@/domain/opening-hours";
import {
  Button,
  Field,
  Input,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import {
  DEFAULT_OPEN_RANGE,
  DayRangesEditor,
  buildRangesValidation,
  cloneRanges,
  nextDefaultRange,
  type DayRangesEditorLabels,
} from "./day-ranges-editor";

type ExceptionMode = "closed" | "custom";

interface ExceptionDraft {
  from: string;
  to: string;
  mode: ExceptionMode;
  ranges: TimeRange[];
  note: string;
}

export interface ExceptionDraftErrors {
  from?: string;
  to?: string;
  note?: string;
  ranges?: string;
  form?: string;
}

type ExceptionLabels = ReturnType<typeof getDictionary>["settings"]["hoursExceptions"];

/**
 * Validates a draft against `hoursExceptionsSchema` together with the other exceptions and maps
 * the (English) schema issues to localized, field-level messages.
 */
export function validateExceptionDraft(
  draft: ExceptionDraft,
  others: readonly HoursException[],
  t: ExceptionLabels,
): { errors: ExceptionDraftErrors; value: HoursException | null } {
  const errors: ExceptionDraftErrors = {};
  const note = draft.note.trim();

  if (!draft.from) errors.from = t.errorDateRequired;
  if (!draft.to) errors.to = t.errorDateRequired;
  if (note.length > MAX_EXCEPTION_NOTE_LENGTH) {
    errors.note = interpolate(t.errorNoteTooLong, { max: MAX_EXCEPTION_NOTE_LENGTH });
  }
  if (draft.mode === "custom" && draft.ranges.length === 0) errors.ranges = t.errorNoRanges;
  if (errors.from || errors.to) return { errors, value: null };

  const candidate: HoursException = {
    from: draft.from,
    to: draft.to,
    ranges: draft.mode === "closed" ? [] : cloneRanges(draft.ranges),
    ...(note ? { note } : {}),
  };

  const parsed = hoursExceptionsSchema.safeParse([...others, candidate]);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[1];
      if (issue.path.length === 1) {
        errors.form = t.errorTooMany;
      } else if (field === "from") {
        errors.from = issue.message.includes("overlap") ? t.errorOverlap : t.errorDateRequired;
      } else if (field === "to") {
        errors.to =
          candidate.to < candidate.from
            ? t.errorEndBeforeStart
            : interpolate(t.errorSpan, { max: MAX_EXCEPTION_SPAN_DAYS });
      } else if (field === "note") {
        errors.note ??= interpolate(t.errorNoteTooLong, { max: MAX_EXCEPTION_NOTE_LENGTH });
      } else if (field === "ranges") {
        errors.ranges ??= t.errorFixBeforeSave;
      }
    }
  }

  return { errors, value: Object.keys(errors).length === 0 ? candidate : null };
}

function initialDraft(exception: HoursException | null, defaultDate: string): ExceptionDraft {
  if (!exception) {
    return {
      from: defaultDate,
      to: defaultDate,
      mode: "closed",
      ranges: [{ ...DEFAULT_OPEN_RANGE }],
      note: "",
    };
  }
  const closed = exception.ranges.length === 0;
  return {
    from: exception.from,
    to: exception.to,
    mode: closed ? "closed" : "custom",
    ranges: closed ? [{ ...DEFAULT_OPEN_RANGE }] : cloneRanges(exception.ranges),
    note: exception.note ?? "",
  };
}

interface ExceptionFormProps {
  exception: HoursException | null;
  others: readonly HoursException[];
  defaultDate: string;
  locale: SupportedLocale;
  busy: boolean;
  submitError: string | null;
  onSave: (value: HoursException) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function ExceptionForm({
  exception,
  others,
  defaultDate,
  locale,
  busy,
  submitError,
  onSave,
  onCancel,
  onDelete,
}: ExceptionFormProps) {
  const dict = getDictionary(locale).settings;
  const t = dict.hoursExceptions;
  const oh = dict.openingHours;
  const rangeLabels: DayRangesEditorLabels = useMemo(
    () => ({
      openTimeLabel: oh.openTimeLabel,
      closeTimeLabel: oh.closeTimeLabel,
      addRange: oh.addRange,
      removeRangeAria: oh.removeRangeAria,
      rangeAria: oh.rangeAria,
      errorCloseAfterOpen: oh.errorCloseAfterOpen,
      errorRangeOverlap: oh.errorRangeOverlap,
      errorMaxRanges: oh.errorMaxRanges,
      errorInvalidTime: oh.errorInvalidTime,
    }),
    [oh],
  );

  const [draft, setDraft] = useState<ExceptionDraft>(() => initialDraft(exception, defaultDate));
  const [toTouched, setToTouched] = useState(exception !== null && exception.from !== exception.to);
  const [submitted, setSubmitted] = useState(false);

  const { errors, value } = useMemo(
    () => validateExceptionDraft(draft, others, t),
    [draft, others, t],
  );
  const rangesValidation = useMemo(
    () => buildRangesValidation(draft.ranges, rangeLabels),
    [draft.ranges, rangeLabels],
  );
  const noteLength = draft.note.length;
  const noteOver = draft.note.trim().length > MAX_EXCEPTION_NOTE_LENGTH;
  const show = (message?: string) => (submitted ? message : undefined);

  const patch = (next: Partial<ExceptionDraft>) => setDraft((prev) => ({ ...prev, ...next }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!value || rangesValidation.rangeErrors.size > 0 || rangesValidation.dayErrors.length > 0) {
      return;
    }
    onSave(value);
  };

  const setRanges = (ranges: TimeRange[]) => patch({ ranges });

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 space-y-4"
      data-testid="exception-form"
    >
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
        <Field label={t.startDateLabel} error={show(errors.from)} required>
          <Input
            type="date"
            value={draft.from}
            disabled={busy}
            data-testid="exception-from"
            className="tabular-nums"
            onChange={(e) => {
              const from = e.target.value;
              patch({ from, ...(toTouched ? {} : { to: from }) });
            }}
          />
        </Field>
        <Field label={t.endDateLabel} error={show(errors.to)} hint={t.endDateHint} required>
          <Input
            type="date"
            value={draft.to}
            min={draft.from || undefined}
            disabled={busy}
            data-testid="exception-to"
            className="tabular-nums"
            onChange={(e) => {
              setToTouched(true);
              patch({ to: e.target.value });
            }}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <span className="text-label-md text-foreground block">{t.statusLabel}</span>
        <SegmentedControl<ExceptionMode>
          aria-label={t.statusLabel}
          value={draft.mode}
          onValueChange={(mode) => patch({ mode })}
          disabled={busy}
          className="grid grid-cols-2 gap-1"
          optionClassName="min-h-11 px-2 py-1.5 text-sm text-center"
          data-testid="exception-mode"
          options={[
            { value: "closed", label: t.statusClosed, "data-testid": "exception-mode-closed" },
            { value: "custom", label: t.statusCustom, "data-testid": "exception-mode-custom" },
          ]}
        />
      </div>

      {draft.mode === "custom" && (
        <fieldset
          disabled={busy}
          className="border-border bg-card min-w-0 rounded-2xl border p-4"
          data-testid="exception-ranges"
        >
          <legend className="sr-only">{t.customHoursGroup}</legend>
          <DayRangesEditor
            ranges={draft.ranges}
            rangeErrors={rangesValidation.rangeErrors}
            dayErrors={rangesValidation.dayErrors}
            groupId="exception"
            groupLabel={t.customHoursGroup}
            labels={rangeLabels}
            disabled={busy}
            onRangeChange={(index, field, newVal) =>
              setRanges(draft.ranges.map((r, i) => (i === index ? { ...r, [field]: newVal } : r)))
            }
            onAddRange={() => {
              if (draft.ranges.length >= MAX_RANGES_PER_DAY) return;
              setRanges([...draft.ranges, nextDefaultRange(draft.ranges)]);
            }}
            onRemoveRange={(index) => setRanges(draft.ranges.filter((_, i) => i !== index))}
          />
          {show(errors.ranges) && draft.ranges.length === 0 && (
            <p role="alert" className="text-body-sm text-destructive mt-2">
              {errors.ranges}
            </p>
          )}
        </fieldset>
      )}

      <Field
        label={t.noteLabel}
        error={show(errors.note)}
        hint={
          <span
            data-testid="exception-note-counter"
            className={noteOver ? "text-destructive" : undefined}
          >
            {interpolate(t.noteCounter, { count: noteLength, max: MAX_EXCEPTION_NOTE_LENGTH })}
          </span>
        }
      >
        <Input
          value={draft.note}
          placeholder={t.notePlaceholder}
          disabled={busy}
          data-testid="exception-note"
          onChange={(e) => patch({ note: e.target.value })}
        />
      </Field>

      {(show(errors.form) || submitError) && (
        <div
          role="alert"
          data-testid="exception-form-error"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{show(errors.form) ?? submitError}</span>
        </div>
      )}

      <SheetFooter>
        <Button
          type="submit"
          loading={busy}
          disabled={busy}
          data-testid="exception-save"
          className="min-h-11 rounded-xl"
        >
          {t.saveButton}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={busy}
          data-testid="exception-cancel"
          className="min-h-11 rounded-xl"
        >
          {t.cancelButton}
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={busy}
            data-testid="exception-delete"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 min-h-11 rounded-xl"
          >
            {t.deleteButton}
          </Button>
        )}
      </SheetFooter>
    </form>
  );
}

export interface ExceptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exception being edited, or `null` to add a new one. */
  exception: HoursException | null;
  /** Every other exception (excluding the one edited), for overlap validation. */
  others: readonly HoursException[];
  /** Today on the business calendar (YYYY-MM-DD): default date of a new exception. */
  defaultDate: string;
  locale: SupportedLocale;
  busy?: boolean;
  submitError?: string | null;
  onSave: (value: HoursException) => void;
  onDelete?: () => void;
}

/** Modal sheet to add or edit one holiday / exceptional day (#375). */
export function ExceptionSheet({
  open,
  onOpenChange,
  exception,
  others,
  defaultDate,
  locale,
  busy = false,
  submitError = null,
  onSave,
  onDelete,
}: ExceptionSheetProps) {
  const t = getDictionary(locale).settings.hoursExceptions;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-2xl"
        data-testid="exception-sheet"
      >
        <SheetHeader>
          <SheetTitle>{exception ? t.sheetEditTitle : t.sheetAddTitle}</SheetTitle>
          <SheetDescription>{t.sheetDescription}</SheetDescription>
        </SheetHeader>
        {open && (
          <ExceptionForm
            key={exception ? `${exception.from}-${exception.to}` : "new"}
            exception={exception}
            others={others}
            defaultDate={defaultDate}
            locale={locale}
            busy={busy}
            submitError={submitError}
            onSave={onSave}
            onCancel={() => onOpenChange(false)}
            onDelete={exception ? onDelete : undefined}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
