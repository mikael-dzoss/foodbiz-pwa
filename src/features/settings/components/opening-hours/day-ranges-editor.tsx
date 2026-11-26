"use client";

import { useId } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { interpolate } from "@/domain/i18n";
import { MAX_RANGES_PER_DAY, dayRangesSchema, type TimeRange } from "@/domain/opening-hours";
import { Button, NativeSelect } from "@/components/ui";

export interface DayRangesEditorLabels {
  openTimeLabel: string;
  closeTimeLabel: string;
  addRange: string;
  removeRangeAria: string;
  rangeAria: string;
  errorCloseAfterOpen: string;
  errorRangeOverlap: string;
  errorMaxRanges: string;
  errorInvalidTime: string;
}

export const DEFAULT_OPEN_RANGE: TimeRange = { open: "09:00", close: "18:00" };

function buildStepTimes(includeEndOfDay: boolean): readonly string[] {
  const times: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    times.push(`${h}:${m}`);
  }
  if (includeEndOfDay) {
    times.push("24:00");
  }
  return times;
}

const OPEN_TIME_OPTIONS = buildStepTimes(false);
const CLOSE_TIME_OPTIONS = buildStepTimes(true);

function optionsWithCurrent(base: readonly string[], current: string): readonly string[] {
  if (!current || base.includes(current)) return base;
  return [...base, current].toSorted((a, b) => a.localeCompare(b));
}

export function cloneRanges(ranges: readonly TimeRange[]): TimeRange[] {
  return ranges.map((r) => ({ open: r.open, close: r.close }));
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatMinutes(total: number): string {
  const clamped = Math.min(24 * 60, Math.max(0, total));
  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
  const m = String(clamped % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function nextDefaultRange(existing: readonly TimeRange[]): TimeRange {
  const last = existing.at(-1);
  if (!last) return { ...DEFAULT_OPEN_RANGE };
  const lastClose = parseMinutes(last.close);
  if (lastClose <= 15 * 60) {
    return { open: "18:00", close: "22:00" };
  }
  if (lastClose <= 22 * 60) {
    const open = lastClose + 60;
    const close = Math.min(24 * 60, open + 120);
    if (open < close) {
      return { open: formatMinutes(open), close: formatMinutes(close) };
    }
  }
  if (lastClose < 23 * 60 + 45) {
    return { open: formatMinutes(lastClose + 15), close: "24:00" };
  }
  return { open: "23:45", close: "24:00" };
}

export interface RangeValidationError {
  openInvalid: boolean;
  closeInvalid: boolean;
  messages: string[];
}

/** Classifies one zod issue on a range (`field`) into the localized per-range error entry. */
export function addRangeIssue(
  target: Map<number, RangeValidationError>,
  rangeIndex: number,
  field: unknown,
  code: string,
  labels: DayRangesEditorLabels,
): void {
  const existing = target.get(rangeIndex) ?? {
    openInvalid: false,
    closeInvalid: false,
    messages: [],
  };
  let message: string;
  if (field === "close" && code === "custom") {
    message = labels.errorCloseAfterOpen;
    existing.closeInvalid = true;
  } else if (field === "open" && code === "custom") {
    message = labels.errorRangeOverlap;
    existing.openInvalid = true;
  } else {
    message = labels.errorInvalidTime;
    if (field === "open") existing.openInvalid = true;
    if (field === "close") existing.closeInvalid = true;
  }
  if (!existing.messages.includes(message)) existing.messages.push(message);
  target.set(rangeIndex, existing);
}

/** Localized day-level message (too many ranges / malformed) for a non-range issue. */
export function dayIssueMessage(code: string, labels: DayRangesEditorLabels): string {
  return code === "too_big" ? labels.errorMaxRanges : labels.errorInvalidTime;
}

/** Validates one day's ranges against `dayRangesSchema` with localized messages. */
export function buildRangesValidation(
  ranges: readonly TimeRange[],
  labels: DayRangesEditorLabels,
): { rangeErrors: Map<number, RangeValidationError>; dayErrors: string[] } {
  const rangeErrors = new Map<number, RangeValidationError>();
  const dayErrors: string[] = [];
  const parsed = dayRangesSchema.safeParse(ranges);
  if (parsed.success) return { rangeErrors, dayErrors };
  for (const issue of parsed.error.issues) {
    const [index, field] = issue.path;
    if (typeof index === "number") {
      addRangeIssue(rangeErrors, index, field, issue.code, labels);
    } else {
      const message = dayIssueMessage(issue.code, labels);
      if (!dayErrors.includes(message)) dayErrors.push(message);
    }
  }
  return { rangeErrors, dayErrors };
}

export interface DayRangesEditorProps {
  ranges: readonly TimeRange[];
  rangeErrors: ReadonlyMap<number, RangeValidationError>;
  dayErrors: readonly string[];
  /** Test-id suffix and id namespace (e.g. a day key, `every_day`, or `exception`). */
  groupId: string;
  /** Human label of the day/group, used in accessible names. */
  groupLabel: string;
  labels: DayRangesEditorLabels;
  disabled?: boolean;
  onRangeChange: (rangeIndex: number, field: "open" | "close", value: string) => void;
  onAddRange: () => void;
  onRemoveRange: (rangeIndex: number) => void;
}

/** Open/close range rows with add/remove and inline errors; shared by weekly and exception editors. */
export function DayRangesEditor({
  ranges,
  rangeErrors,
  dayErrors,
  groupId,
  groupLabel,
  labels,
  disabled = false,
  onRangeChange,
  onAddRange,
  onRemoveRange,
}: DayRangesEditorProps) {
  const baseId = useId();
  return (
    <div className="border-border/60 mt-3 space-y-3 border-t pt-3">
      {ranges.map((range, rangeIndex) => {
        const err = rangeErrors.get(rangeIndex);
        const openId = `${baseId}-${groupId}-${rangeIndex}-open`;
        const closeId = `${baseId}-${groupId}-${rangeIndex}-close`;
        const errorId = err ? `${baseId}-${groupId}-${rangeIndex}-error` : undefined;
        const openOptions = optionsWithCurrent(OPEN_TIME_OPTIONS, range.open);
        const closeOptions = optionsWithCurrent(CLOSE_TIME_OPTIONS, range.close);

        return (
          <div key={rangeIndex} className="space-y-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-end gap-2">
              <div className="min-w-0">
                <label htmlFor={openId} className="text-label-sm text-muted-foreground mb-1 block">
                  {labels.openTimeLabel}
                  <span className="sr-only">{`, ${groupLabel}, ${interpolate(labels.rangeAria, { index: rangeIndex + 1 })}`}</span>
                </label>
                <NativeSelect
                  id={openId}
                  value={range.open}
                  onChange={(e) => onRangeChange(rangeIndex, "open", e.target.value)}
                  aria-invalid={err?.openInvalid || undefined}
                  aria-describedby={err?.openInvalid ? errorId : undefined}
                  disabled={disabled}
                  data-testid={`time-open-${groupId}-${rangeIndex}`}
                  className="h-11 rounded-xl pr-8 pl-2.5 text-base tabular-nums"
                >
                  {openOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <span className="text-muted-foreground pb-3 text-sm" aria-hidden="true">
                –
              </span>

              <div className="min-w-0">
                <label htmlFor={closeId} className="text-label-sm text-muted-foreground mb-1 block">
                  {labels.closeTimeLabel}
                  <span className="sr-only">{`, ${groupLabel}, ${interpolate(labels.rangeAria, { index: rangeIndex + 1 })}`}</span>
                </label>
                <NativeSelect
                  id={closeId}
                  value={range.close}
                  onChange={(e) => onRangeChange(rangeIndex, "close", e.target.value)}
                  aria-invalid={err?.closeInvalid || undefined}
                  aria-describedby={err?.closeInvalid ? errorId : undefined}
                  disabled={disabled}
                  data-testid={`time-close-${groupId}-${rangeIndex}`}
                  className="h-11 rounded-xl pr-8 pl-2.5 text-base tabular-nums"
                >
                  {closeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveRange(rangeIndex)}
                disabled={disabled}
                aria-label={interpolate(labels.removeRangeAria, {
                  index: rangeIndex + 1,
                  day: groupLabel,
                })}
                data-testid={`remove-range-${groupId}-${rangeIndex}`}
                className="text-muted-foreground hover:text-destructive h-11 w-11 shrink-0 rounded-xl"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {err && (
              <p
                id={errorId}
                role="alert"
                data-testid={`range-error-${groupId}-${rangeIndex}`}
                className="text-body-sm text-destructive flex items-start gap-1.5"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{err.messages[0]}</span>
              </p>
            )}
          </div>
        );
      })}

      {dayErrors.length > 0 && (
        <p
          role="alert"
          data-testid={`day-error-${groupId}`}
          className="text-body-sm text-destructive flex items-start gap-1.5"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{dayErrors[0]}</span>
        </p>
      )}

      {ranges.length < MAX_RANGES_PER_DAY && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAddRange()}
          disabled={disabled}
          data-testid={`add-range-${groupId}`}
          className="w-full rounded-xl"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>{labels.addRange}</span>
        </Button>
      )}
    </div>
  );
}
