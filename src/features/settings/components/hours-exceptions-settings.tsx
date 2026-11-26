"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, ChevronDown, ChevronLeft, Plus } from "lucide-react";
import { formatCalendarDate } from "@/domain/formatting/date";
import { getDictionary, interpolate, type SupportedLocale } from "@/domain/i18n";
import type { HoursException } from "@/domain/opening-hours";
import { getZonedDay } from "@/domain/timezone";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { Badge, Button, ConfirmDialog, useToastOptional } from "@/components/ui";
import { cn } from "@/lib/utils";
import { updateHoursExceptionsAction } from "../actions";
import { ExceptionSheet } from "./opening-hours";

export interface HoursExceptionsSettingsProps {
  initial: readonly HoursException[];
  locale: SupportedLocale;
  /** Business IANA timezone (decides which exceptions are past). */
  timeZone: string;
  /** Request-time clock from the server. */
  now: Date;
}

function sortExceptions(list: readonly HoursException[]): HoursException[] {
  return list.toSorted((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

function sameException(a: HoursException, b: HoursException): boolean {
  return a.from === b.from && a.to === b.to;
}

/** Holidays & exceptional days sub-page (#375): list plus add/edit sheet and delete confirm. */
export function HoursExceptionsSettings({
  initial,
  locale,
  timeZone,
  now,
}: HoursExceptionsSettingsProps) {
  const dict = getDictionary(locale).settings;
  const t = dict.hoursExceptions;
  const toast = useToastOptional();

  const [exceptions, setExceptions] = useState<HoursException[]>(() => sortExceptions(initial));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<HoursException | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  const today = getZonedDay(now, timeZone);
  const upcoming = useMemo(() => exceptions.filter((ex) => ex.to >= today), [exceptions, today]);
  const past = useMemo(
    () => exceptions.filter((ex) => ex.to < today).toReversed(),
    [exceptions, today],
  );
  const others = useMemo(
    () => (editing ? exceptions.filter((ex) => !sameException(ex, editing)) : exceptions),
    [exceptions, editing],
  );

  const persist = async (next: HoursException[], successMessage: string): Promise<boolean> => {
    setBusy(true);
    setSubmitError(null);
    try {
      const sorted = sortExceptions(next);
      const res = await updateHoursExceptionsAction({ hoursExceptions: sorted });
      if (res.ok) {
        setExceptions(sorted);
        toast?.showToast(successMessage);
        return true;
      }
      const message = actionErrorMessage(res, locale);
      setSubmitError(message);
      toast?.showError(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setSubmitError(null);
    setSheetOpen(true);
  };

  const openEdit = (ex: HoursException) => {
    setEditing(ex);
    setSubmitError(null);
    setSheetOpen(true);
  };

  const handleSave = async (value: HoursException) => {
    if (await persist([...others, value], t.saveSuccess)) setSheetOpen(false);
  };

  const handleDelete = async () => {
    if (!editing) return;
    const ok = await persist(others, t.deleteSuccess);
    // Always close the dialog so a failure (submitError in the sheet, toast) stays visible.
    setDeleteOpen(false);
    if (ok) setSheetOpen(false);
  };

  const renderRow = (ex: HoursException, muted = false) => {
    const start = formatCalendarDate(ex.from, locale, "medium");
    const date =
      ex.from === ex.to ? start : `${start} – ${formatCalendarDate(ex.to, locale, "medium")}`;
    const closed = ex.ranges.length === 0;
    return (
      <li key={`${ex.from}-${ex.to}`}>
        <button
          type="button"
          onClick={() => openEdit(ex)}
          aria-label={interpolate(t.editAria, { date })}
          data-testid={`exception-row-${ex.from}`}
          className={cn(
            "hover:bg-muted/50 active:bg-muted focus-visible:ring-ring flex min-h-14 w-full flex-col gap-0.5 p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
            muted && "opacity-70",
          )}
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-foreground text-label-md tabular-nums">{date}</span>
            {closed ? (
              <Badge variant="warning" className="shrink-0">
                {t.statusClosed}
              </Badge>
            ) : (
              <span className="text-body-sm text-muted-foreground shrink-0 tabular-nums">
                {ex.ranges.map((r) => `${r.open}–${r.close}`).join(" · ")}
              </span>
            )}
          </span>
          {ex.note && <span className="text-body-sm text-muted-foreground">{ex.note}</span>}
        </button>
      </li>
    );
  };

  return (
    <div
      className="mx-auto w-full max-w-md px-4 py-6 pb-24"
      data-testid="hours-exceptions-settings"
    >
      <div className="mb-6 flex items-center">
        <Link
          href="/manage/settings/opening-hours"
          data-testid="back-to-opening-hours"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          <span>{dict.openingHours.title}</span>
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
          data-testid="exception-add"
          className="min-h-11 shrink-0 rounded-xl"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{t.addButton}</span>
        </Button>
      </div>

      {upcoming.length === 0 ? (
        <div
          data-testid="exceptions-empty"
          className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border p-6 text-center"
        >
          <CalendarOff className="text-muted-foreground h-6 w-6" aria-hidden="true" />
          <p className="text-label-md text-foreground">{t.emptyTitle}</p>
          <p className="text-body-sm text-muted-foreground">{t.emptyHint}</p>
        </div>
      ) : (
        <section aria-labelledby="exceptions-upcoming-heading">
          <h2
            id="exceptions-upcoming-heading"
            className="text-label-sm text-muted-foreground mb-2 px-1 tracking-wider uppercase"
          >
            {t.upcomingSection}
          </h2>
          <ul
            data-testid="exceptions-upcoming"
            className="border-border bg-card divide-border divide-y overflow-hidden rounded-2xl border shadow-2xs"
          >
            {upcoming.map((ex) => renderRow(ex))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-6" aria-labelledby="exceptions-past-heading">
          <h2 id="exceptions-past-heading" className="sr-only">
            {t.pastSection}
          </h2>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={showPast}
            onClick={() => setShowPast((v) => !v)}
            data-testid="exceptions-past-toggle"
            className="min-h-11 rounded-xl px-2"
          >
            <span>{showPast ? t.hidePast : interpolate(t.showPast, { count: past.length })}</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showPast && "rotate-180")}
              aria-hidden="true"
            />
          </Button>
          {showPast && (
            <ul
              id="exceptions-past-list"
              data-testid="exceptions-past"
              className="border-border bg-card divide-border mt-2 divide-y overflow-hidden rounded-2xl border shadow-2xs"
            >
              {past.map((ex) => renderRow(ex, true))}
            </ul>
          )}
        </section>
      )}

      <ExceptionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        exception={editing}
        others={others}
        defaultDate={today}
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
        data-testid="exception-delete-dialog"
      />
    </div>
  );
}
