"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Alert } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SoonBadge } from "@/components/feedback";
import {
  STANDARD_EXPENSE_TAGS,
  formatMoney,
  type Expense,
  type StandardExpenseTag,
} from "@/domain";
import { createExpenseAction, updateExpenseAction, deleteExpenseAction } from "../expense-actions";
import { Check, Trash2, FileText } from "lucide-react";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { useManagerLocale } from "@/components/i18n";
import { interpolate } from "@/domain/i18n";

export interface ExpenseSheetProps {
  /** Today on the business calendar (YYYY-MM-DD): the default date of a new expense. */
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  onSaved?: (expense: Expense) => void;
  onDeleted?: (id: string) => void;
  /** Why deleting is unavailable to this member (owner-only); the control is disabled and explained. */
  deleteDisabledReason?: string;
}

interface ExpenseFormProps {
  today: string;
  expense?: Expense | null;
  onClose: () => void;
  onSaved?: (expense: Expense) => void;
  onDeleted?: (id: string) => void;
  deleteDisabledReason?: string;
}

/** Server field messages are English zod text: show a localized generic message per field instead. */
function localizeFieldErrors(
  errors: Record<string, string[]>,
  message: string,
): Record<string, string[]> {
  return Object.fromEntries(Object.keys(errors).map((field) => [field, [message]]));
}

function ExpenseForm({
  today,
  expense,
  onClose,
  onSaved,
  onDeleted,
  deleteDisabledReason,
}: ExpenseFormProps) {
  const isEdit = Boolean(expense);
  const { locale, dict } = useManagerLocale();
  const t = dict.expenses.sheet;
  const tags = dict.expenses.tags;

  // Form states initialized directly from props (key change handles resets)
  const [amountStr, setAmountStr] = React.useState(
    expense ? (expense.amount / 100).toFixed(2) : "",
  );
  const [description, setDescription] = React.useState(expense ? expense.description : "");
  const [date, setDate] = React.useState(expense ? expense.date : today);
  const [selectedTags, setSelectedTags] = React.useState<string[]>(
    expense && expense.tags.length > 0 ? [...expense.tags] : ["Ingredients"],
  );

  // UI & submission states
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const clearFieldError = (field: string) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleTagToggle = (tag: StandardExpenseTag) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        if (prev.length === 1) return prev;
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
    if (fieldErrors.tags) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.tags;
        return next;
      });
    }
  };

  const handleQuickAddAmount = (centsToAdd: number) => {
    const current = Number.parseFloat(amountStr.replace(",", ".")) || 0;
    const nextAmount = Math.max(0, current + centsToAdd / 100);
    setAmountStr(nextAmount.toFixed(2));
    if (fieldErrors.amount) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.amount;
        return next;
      });
    }
  };

  const [, formAction, isSubmitting] = React.useActionState(async (): Promise<null> => {
    setErrorMessage(null);
    setFieldErrors({});

    const normalizedAmountStr = amountStr.replace(",", ".").trim();
    const parsedAmount = Number.parseFloat(normalizedAmountStr);
    const amountInCents = Math.round(parsedAmount * 100);

    if (Number.isNaN(parsedAmount) || amountInCents <= 0) {
      setFieldErrors((prev) => ({
        ...prev,
        amount: [t.errors.amount],
      }));
      return null;
    }

    if (!description.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        description: [t.errors.description],
      }));
      return null;
    }

    if (!date.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        date: [t.errors.date],
      }));
      return null;
    }

    if (selectedTags.length === 0) {
      setFieldErrors((prev) => ({
        ...prev,
        tags: [t.errors.tags],
      }));
      return null;
    }

    try {
      if (isEdit && expense) {
        const res = await updateExpenseAction({
          id: expense.id,
          amount: amountInCents,
          description: description.trim(),
          date: date.trim(),
          tags: selectedTags,
        });

        if (res.ok) {
          onSaved?.(res.data);
          onClose();
        } else {
          setErrorMessage(actionErrorMessage(res, locale));
          if (res.fieldErrors) {
            setFieldErrors(localizeFieldErrors(res.fieldErrors, t.errors.invalidField));
          }
        }
      } else {
        const res = await createExpenseAction({
          amount: amountInCents,
          description: description.trim(),
          date: date.trim(),
          tags: selectedTags,
        });

        if (res.ok) {
          onSaved?.(res.data);
          onClose();
        } else {
          setErrorMessage(actionErrorMessage(res, locale));
          if (res.fieldErrors) {
            setFieldErrors(localizeFieldErrors(res.fieldErrors, t.errors.invalidField));
          }
        }
      }
    } catch {
      setErrorMessage(actionErrorMessage({ code: "INTERNAL" }, locale));
    }
    return null;
  }, null);

  const handleDelete = async () => {
    if (!expense) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const res = await deleteExpenseAction(expense.id);
      if (res.ok) {
        onDeleted?.(expense.id);
        setShowDeleteConfirm(false);
        onClose();
      } else {
        setErrorMessage(actionErrorMessage(res, locale));
        setShowDeleteConfirm(false);
      }
    } catch {
      setErrorMessage(actionErrorMessage({ code: "INTERNAL" }, locale));
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <SheetHeader className="mb-4">
        <div className="flex items-center justify-between">
          <SheetTitle data-testid="expense-sheet-title">
            {isEdit ? t.titleEdit : t.titleNew}
          </SheetTitle>
        </div>
        <SheetDescription>{isEdit ? t.descriptionEdit : t.descriptionNew}</SheetDescription>
      </SheetHeader>

      {errorMessage && (
        <Alert tone="error" data-testid="expense-error-message" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form action={formAction} className="space-y-4">
        {/* Amount input */}
        <div className="space-y-1.5">
          <Field id="expense-amount" label={t.amountLabel} error={fieldErrors.amount?.[0]}>
            {(control) => (
              <div className="border-input bg-card focus-within:border-primary relative flex items-center rounded-lg border p-2.5 transition-colors">
                <span className="text-muted-foreground mr-2 text-xl font-bold">€</span>
                <Input
                  {...control}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    clearFieldError("amount");
                  }}
                  className="text-foreground placeholder:text-muted-foreground/50 h-auto min-h-0 w-full border-0 bg-transparent p-0 text-xl font-bold tabular-nums focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="expense-amount-input"
                />
              </div>
            )}
          </Field>

          {/* Quick increment chips */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="unstyled"
              size="none"
              type="button"
              onClick={() => handleQuickAddAmount(1000)}
              className="border-border bg-muted/40 hover:bg-muted text-foreground rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-95"
            >
              +{formatMoney(1000, locale)}
            </Button>
            <Button
              variant="unstyled"
              size="none"
              type="button"
              onClick={() => handleQuickAddAmount(5000)}
              className="border-border bg-muted/40 hover:bg-muted text-foreground rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-95"
            >
              +{formatMoney(5000, locale)}
            </Button>
            <Button
              variant="unstyled"
              size="none"
              type="button"
              onClick={() => handleQuickAddAmount(10000)}
              className="border-border bg-muted/40 hover:bg-muted text-foreground rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-95"
            >
              +{formatMoney(10000, locale)}
            </Button>
          </div>
        </div>

        {/* Description / Vendor */}
        <Field
          id="expense-description"
          label={t.descriptionLabel}
          error={fieldErrors.description?.[0]}
        >
          <Input
            type="text"
            placeholder={t.descriptionPlaceholder}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clearFieldError("description");
            }}
            data-testid="expense-description-input"
          />
        </Field>

        {/* Date */}
        <Field id="expense-date" label={t.dateLabel} error={fieldErrors.date?.[0]}>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              clearFieldError("date");
            }}
            data-testid="expense-date-input"
          />
        </Field>

        {/* Expense Category Tags */}
        <div className="space-y-1.5">
          <label className="text-foreground text-xs font-semibold tracking-wider uppercase">
            {t.categoryLabel}
          </label>
          <div
            className="flex flex-wrap gap-2 pt-1"
            role="group"
            aria-label={t.categoriesGroupLabel}
          >
            {STANDARD_EXPENSE_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Button
                  variant="unstyled"
                  size="none"
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  aria-pressed={isSelected}
                  className={
                    isSelected
                      ? "bg-primary-soft text-primary-soft-foreground border-primary flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
                      : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
                  }
                  data-testid={`expense-tag-${tag}`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                  <span>{tags[tag]}</span>
                </Button>
              );
            })}
          </div>
          {fieldErrors.tags && <p className="text-destructive text-xs">{fieldErrors.tags[0]}</p>}
        </div>

        {/* Receipt document helper (upcoming feature with SoonBadge per Stitch signal) */}
        <div className="border-border/60 bg-muted/20 flex items-center justify-between rounded-xl border border-dashed p-3">
          <div className="flex items-center gap-3">
            <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-foreground text-xs font-medium">{t.attachReceipt}</span>
              <span className="text-muted-foreground text-caption">{t.ocr}</span>
            </div>
          </div>
          {/* TODO(expenses): attach receipt or invoice (#57) */}
          <SoonBadge />
        </div>

        {/* Primary & secondary actions */}
        <div className="space-y-2 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full text-sm font-semibold"
            data-testid="expense-submit-button"
          >
            {isSubmitting ? t.saving : isEdit ? t.saveChanges : t.save}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onClose}
            className="h-11 w-full text-sm"
          >
            {t.cancel}
          </Button>

          {/* Destructive delete option in edit mode */}
          {isEdit && (
            <div className="pt-2 text-center">
              <Button
                variant="unstyled"
                size="none"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={Boolean(deleteDisabledReason)}
                aria-describedby={deleteDisabledReason ? "expense-delete-reason" : undefined}
                className="text-destructive inline-flex min-h-9 items-center gap-1.5 py-2 text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                data-testid="expense-delete-trigger"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t.deleteTrigger}</span>
              </Button>
              {deleteDisabledReason && (
                <p
                  id="expense-delete-reason"
                  className="text-muted-foreground text-body-sm"
                  data-testid="expense-delete-owner-only"
                >
                  {deleteDisabledReason}
                </p>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        destructive
        loading={isDeleting}
        title={t.deleteTitle}
        description={interpolate(t.deleteDescription, { name: expense?.description ?? "" })}
        cancelLabel={t.cancel}
        confirmLabel={isDeleting ? t.deleting : t.deleteConfirm}
        onConfirm={handleDelete}
        data-testid="expense-delete-dialog"
        confirmTestId="expense-delete-confirm-button"
      />
    </>
  );
}

export function ExpenseSheet({
  open,
  onOpenChange,
  expense,
  onSaved,
  onDeleted,
  deleteDisabledReason,
  today,
}: ExpenseSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[90vh] max-w-lg overflow-y-auto rounded-t-2xl pb-8"
        data-testid="expense-sheet"
      >
        {/* Centered drag handle */}
        <div className="bg-muted-foreground/30 mx-auto my-2 h-1.5 w-12 rounded-full" />

        {open && (
          <ExpenseForm
            today={today}
            key={expense ? expense.id : "new-expense"}
            expense={expense}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
            onDeleted={onDeleted}
            deleteDisabledReason={deleteDisabledReason}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
