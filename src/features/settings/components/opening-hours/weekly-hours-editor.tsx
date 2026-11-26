"use client";

import { useId, useMemo, useRef, useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { getDictionary, interpolate, type SupportedLocale } from "@/domain/i18n";
import {
  DAY_KEYS,
  MAX_RANGES_PER_DAY,
  weeklyHoursSchema,
  type DayKey,
  type TimeRange,
  type WeeklyHours,
} from "@/domain/opening-hours";
import { Button, NativeSelect, SegmentedControl, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";

export type WeeklyHoursPresetMode = "every_day" | "weekdays_weekend" | "custom";

export interface WeeklyHoursEditorLabels {
  presetLabel: string;
  presetEveryDay: string;
  presetWeekdaysWeekend: string;
  presetCustom: string;
  groupEveryDay: string;
  groupWeekdays: string;
  groupWeekend: string;
  open: string;
  closed: string;
  openTimeLabel: string;
  closeTimeLabel: string;
  addRange: string;
  removeRangeAria: string;
  toggleDayAria: string;
  overnightHint: string;
  errorCloseAfterOpen: string;
  errorRangeOverlap: string;
  errorMaxRanges: string;
  errorInvalidTime: string;
}

export interface WeeklyHoursEditorProps {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
  locale?: SupportedLocale;
  labels?: WeeklyHoursEditorLabels;
  disabled?: boolean;
  "data-testid"?: string;
}

const WEEKDAY_KEYS: readonly DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
const WEEKEND_KEYS: readonly DayKey[] = ["sat", "sun"];
const DEFAULT_OPEN_RANGE: TimeRange = { open: "09:00", close: "18:00" };

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

function cloneRanges(ranges: readonly TimeRange[]): TimeRange[] {
  return ranges.map((r) => ({ open: r.open, close: r.close }));
}

export function cloneWeeklyHours(hours: WeeklyHours): WeeklyHours {
  return {
    mon: cloneRanges(hours.mon),
    tue: cloneRanges(hours.tue),
    wed: cloneRanges(hours.wed),
    thu: cloneRanges(hours.thu),
    fri: cloneRanges(hours.fri),
    sat: cloneRanges(hours.sat),
    sun: cloneRanges(hours.sun),
  };
}

/** Sensible initial weekly schedule when structured hours are not configured yet. */
export function createDefaultWeeklyHours(): WeeklyHours {
  return {
    mon: [{ ...DEFAULT_OPEN_RANGE }],
    tue: [{ ...DEFAULT_OPEN_RANGE }],
    wed: [{ ...DEFAULT_OPEN_RANGE }],
    thu: [{ ...DEFAULT_OPEN_RANGE }],
    fri: [{ ...DEFAULT_OPEN_RANGE }],
    sat: [{ ...DEFAULT_OPEN_RANGE }],
    sun: [{ ...DEFAULT_OPEN_RANGE }],
  };
}

function sameRanges(a: readonly TimeRange[], b: readonly TimeRange[]): boolean {
  return (
    a.length === b.length &&
    a.every((range, idx) => range.open === b[idx].open && range.close === b[idx].close)
  );
}

/** Detects which preset grouping best matches an existing `WeeklyHours` value. */
export function detectPresetMode(hours: WeeklyHours): WeeklyHoursPresetMode {
  const allEqual = DAY_KEYS.every((day) => sameRanges(hours[day], hours.mon));
  if (allEqual) return "every_day";

  const weekdaysEqual = WEEKDAY_KEYS.every((day) => sameRanges(hours[day], hours.mon));
  const weekendEqual = sameRanges(hours.sat, hours.sun);
  if (weekdaysEqual && weekendEqual) return "weekdays_weekend";

  return "custom";
}

function formatDayName(index: number, locale: SupportedLocale): string {
  const raw = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, 0, 1 + index, 12)),
  );
  return raw ? raw[0].toLocaleUpperCase(locale) + raw.slice(1) : raw;
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

function nextDefaultRange(existing: readonly TimeRange[]): TimeRange {
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

interface RangeValidationError {
  openInvalid: boolean;
  closeInvalid: boolean;
  messages: string[];
}

interface ParsedValidation {
  rangeErrors: Map<string, RangeValidationError>;
  dayErrors: Map<DayKey, string[]>;
}

function buildValidationMap(hours: WeeklyHours, labels: WeeklyHoursEditorLabels): ParsedValidation {
  const rangeErrors = new Map<string, RangeValidationError>();
  const dayErrors = new Map<DayKey, string[]>();

  const parsed = weeklyHoursSchema.safeParse(hours);
  if (parsed.success) return { rangeErrors, dayErrors };

  for (const issue of parsed.error.issues) {
    const dayKey = issue.path[0];
    if (typeof dayKey !== "string" || !(DAY_KEYS as readonly string[]).includes(dayKey)) continue;
    const typedDay = dayKey as DayKey;
    const rangeIndex = issue.path[1];
    const field = issue.path[2];

    if (typeof rangeIndex === "number") {
      const key = `${typedDay}:${rangeIndex}`;
      const existing = rangeErrors.get(key) ?? {
        openInvalid: false,
        closeInvalid: false,
        messages: [],
      };
      let message: string;
      if (field === "close" && issue.code === "custom") {
        message = labels.errorCloseAfterOpen;
        existing.closeInvalid = true;
      } else if (field === "open" && issue.code === "custom") {
        message = labels.errorRangeOverlap;
        existing.openInvalid = true;
      } else {
        message = labels.errorInvalidTime;
        if (field === "open") existing.openInvalid = true;
        if (field === "close") existing.closeInvalid = true;
      }
      if (!existing.messages.includes(message)) {
        existing.messages.push(message);
      }
      rangeErrors.set(key, existing);
    } else {
      const list = dayErrors.get(typedDay) ?? [];
      const message = issue.code === "too_big" ? labels.errorMaxRanges : labels.errorInvalidTime;
      if (!list.includes(message)) list.push(message);
      dayErrors.set(typedDay, list);
    }
  }

  return { rangeErrors, dayErrors };
}

function defaultEditorLabels(locale: SupportedLocale): WeeklyHoursEditorLabels {
  const oh = getDictionary(locale).settings.openingHours;
  return {
    presetLabel: oh.presetLabel,
    presetEveryDay: oh.presetEveryDay,
    presetWeekdaysWeekend: oh.presetWeekdaysWeekend,
    presetCustom: oh.presetCustom,
    groupEveryDay: oh.groupEveryDay,
    groupWeekdays: oh.groupWeekdays,
    groupWeekend: oh.groupWeekend,
    open: oh.open,
    closed: oh.closed,
    openTimeLabel: oh.openTimeLabel,
    closeTimeLabel: oh.closeTimeLabel,
    addRange: oh.addRange,
    removeRangeAria: oh.removeRangeAria,
    toggleDayAria: oh.toggleDayAria,
    overnightHint: oh.overnightHint,
    errorCloseAfterOpen: oh.errorCloseAfterOpen,
    errorRangeOverlap: oh.errorRangeOverlap,
    errorMaxRanges: oh.errorMaxRanges,
    errorInvalidTime: oh.errorInvalidTime,
  };
}

interface EditorGroup {
  id: string;
  label: string;
  days: readonly DayKey[];
}

/**
 * Reusable weekly opening hours editor (#372).
 * Presets ("Every day", "Weekdays + weekend", "Custom") only write per-day `WeeklyHours` data;
 * validates inline against `weeklyHoursSchema`.
 */
export function WeeklyHoursEditor({
  value,
  onChange,
  locale = "en",
  labels: providedLabels,
  disabled = false,
  "data-testid": testId = "weekly-hours-editor",
}: WeeklyHoursEditorProps) {
  const baseId = useId();
  const labels = useMemo(
    () => providedLabels ?? defaultEditorLabels(locale),
    [providedLabels, locale],
  );
  const [mode, setMode] = useState<WeeklyHoursPresetMode>(() => detectPresetMode(value));
  const savedRangesByGroup = useRef<Map<string, TimeRange[]>>(new Map());

  const validation = useMemo(() => buildValidationMap(value, labels), [value, labels]);

  const groups: readonly EditorGroup[] = useMemo(() => {
    if (mode === "every_day") {
      return [{ id: "every_day", label: labels.groupEveryDay, days: DAY_KEYS }];
    }
    if (mode === "weekdays_weekend") {
      return [
        { id: "weekdays", label: labels.groupWeekdays, days: WEEKDAY_KEYS },
        { id: "weekend", label: labels.groupWeekend, days: WEEKEND_KEYS },
      ];
    }
    return DAY_KEYS.map((day, idx) => ({
      id: day,
      label: formatDayName(idx, locale),
      days: [day],
    }));
  }, [mode, labels.groupEveryDay, labels.groupWeekdays, labels.groupWeekend, locale]);

  const updateDays = (days: readonly DayKey[], ranges: readonly TimeRange[]) => {
    const next = cloneWeeklyHours(value);
    for (const day of days) {
      next[day] = cloneRanges(ranges);
    }
    onChange(next);
  };

  const handlePresetChange = (nextMode: WeeklyHoursPresetMode) => {
    setMode(nextMode);
    if (nextMode === "custom") return;

    if (nextMode === "every_day") {
      const templateDay = DAY_KEYS.find((day) => value[day].length > 0) ?? "mon";
      const template = value[templateDay];
      if (!DAY_KEYS.every((day) => sameRanges(value[day], template))) {
        updateDays(DAY_KEYS, template);
      }
      return;
    }

    // weekdays_weekend
    const weekdayTemplateDay = WEEKDAY_KEYS.find((day) => value[day].length > 0) ?? "mon";
    const weekendTemplateDay = WEEKEND_KEYS.find((day) => value[day].length > 0) ?? "sat";
    const weekdayTemplate = value[weekdayTemplateDay];
    const weekendTemplate = value[weekendTemplateDay];
    const next = cloneWeeklyHours(value);
    for (const day of WEEKDAY_KEYS) next[day] = cloneRanges(weekdayTemplate);
    for (const day of WEEKEND_KEYS) next[day] = cloneRanges(weekendTemplate);
    onChange(next);
  };

  const handleToggleOpen = (group: EditorGroup, open: boolean) => {
    const current = value[group.days[0]];
    if (!open) {
      if (current.length > 0) {
        savedRangesByGroup.current.set(group.id, cloneRanges(current));
      }
      updateDays(group.days, []);
      return;
    }
    const restored = savedRangesByGroup.current.get(group.id);
    updateDays(
      group.days,
      restored && restored.length > 0 ? restored : [{ ...DEFAULT_OPEN_RANGE }],
    );
  };

  const handleRangeChange = (
    days: readonly DayKey[],
    rangeIndex: number,
    field: "open" | "close",
    newVal: string,
  ) => {
    const current = cloneRanges(value[days[0]]);
    if (!current[rangeIndex]) return;
    current[rangeIndex] = { ...current[rangeIndex], [field]: newVal };
    updateDays(days, current);
  };

  const handleAddRange = (days: readonly DayKey[]) => {
    const current = value[days[0]];
    if (current.length >= MAX_RANGES_PER_DAY) return;
    updateDays(days, [...cloneRanges(current), nextDefaultRange(current)]);
  };

  const handleRemoveRange = (group: EditorGroup, rangeIndex: number) => {
    const current = value[group.days[0]];
    const nextRanges = current
      .filter((_, idx) => idx !== rangeIndex)
      .map((r) => ({ open: r.open, close: r.close }));
    if (nextRanges.length === 0 && current.length > 0) {
      savedRangesByGroup.current.set(group.id, cloneRanges(current));
    }
    updateDays(group.days, nextRanges);
  };

  return (
    <div className="space-y-4" data-testid={testId}>
      <SegmentedControl<WeeklyHoursPresetMode>
        aria-label={labels.presetLabel}
        value={mode}
        onValueChange={handlePresetChange}
        disabled={disabled}
        className="grid grid-cols-3 gap-1"
        optionClassName="min-h-11 px-2 py-1.5 text-xs leading-tight text-center"
        data-testid={`${testId}-presets`}
        options={[
          {
            value: "every_day",
            label: labels.presetEveryDay,
            "data-testid": "preset-every-day",
          },
          {
            value: "weekdays_weekend",
            label: labels.presetWeekdaysWeekend,
            "data-testid": "preset-weekdays-weekend",
          },
          {
            value: "custom",
            label: labels.presetCustom,
            "data-testid": "preset-custom",
          },
        ]}
      />

      <div className="space-y-3">
        {groups.map((group) => {
          const representativeDay = group.days[0];
          const ranges = value[representativeDay];
          const isOpen = ranges.length > 0;
          const groupDayErrors = validation.dayErrors.get(representativeDay) ?? [];

          return (
            <fieldset
              key={group.id}
              disabled={disabled}
              data-testid={`hours-group-${group.id}`}
              className="border-border bg-card min-w-0 rounded-2xl border p-4 shadow-2xs"
            >
              <legend className="sr-only">{group.label}</legend>

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-label-md text-foreground block">{group.label}</span>
                  <span
                    data-testid={`status-${group.id}`}
                    className={cn(
                      "text-label-sm block",
                      isOpen ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {isOpen ? labels.open : labels.closed}
                  </span>
                </div>
                <Switch
                  checked={isOpen}
                  onCheckedChange={(checked) => handleToggleOpen(group, checked)}
                  aria-label={interpolate(labels.toggleDayAria, { day: group.label })}
                  data-testid={`toggle-${group.id}`}
                />
              </div>

              {isOpen && (
                <div className="border-border/60 mt-3 space-y-3 border-t pt-3">
                  {ranges.map((range, rangeIndex) => {
                    const err = validation.rangeErrors.get(`${representativeDay}:${rangeIndex}`);
                    const openId = `${baseId}-${group.id}-${rangeIndex}-open`;
                    const closeId = `${baseId}-${group.id}-${rangeIndex}-close`;
                    const errorId = err ? `${baseId}-${group.id}-${rangeIndex}-error` : undefined;
                    const openOptions = optionsWithCurrent(OPEN_TIME_OPTIONS, range.open);
                    const closeOptions = optionsWithCurrent(CLOSE_TIME_OPTIONS, range.close);

                    return (
                      <div key={rangeIndex} className="space-y-1.5">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-end gap-2">
                          <div className="min-w-0">
                            <label
                              htmlFor={openId}
                              className="text-label-sm text-muted-foreground mb-1 block"
                            >
                              {labels.openTimeLabel}
                              <span className="sr-only">{` ${group.label} ${rangeIndex + 1}`}</span>
                            </label>
                            <NativeSelect
                              id={openId}
                              value={range.open}
                              onChange={(e) =>
                                handleRangeChange(group.days, rangeIndex, "open", e.target.value)
                              }
                              aria-invalid={err?.openInvalid || undefined}
                              aria-describedby={err?.openInvalid ? errorId : undefined}
                              disabled={disabled}
                              data-testid={`time-open-${group.id}-${rangeIndex}`}
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
                            <label
                              htmlFor={closeId}
                              className="text-label-sm text-muted-foreground mb-1 block"
                            >
                              {labels.closeTimeLabel}
                              <span className="sr-only">{` ${group.label} ${rangeIndex + 1}`}</span>
                            </label>
                            <NativeSelect
                              id={closeId}
                              value={range.close}
                              onChange={(e) =>
                                handleRangeChange(group.days, rangeIndex, "close", e.target.value)
                              }
                              aria-invalid={err?.closeInvalid || undefined}
                              aria-describedby={err?.closeInvalid ? errorId : undefined}
                              disabled={disabled}
                              data-testid={`time-close-${group.id}-${rangeIndex}`}
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
                            onClick={() => handleRemoveRange(group, rangeIndex)}
                            disabled={disabled}
                            aria-label={interpolate(labels.removeRangeAria, {
                              index: rangeIndex + 1,
                              day: group.label,
                            })}
                            data-testid={`remove-range-${group.id}-${rangeIndex}`}
                            className="text-muted-foreground hover:text-destructive h-11 w-11 shrink-0 rounded-xl"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>

                        {err && (
                          <p
                            id={errorId}
                            role="alert"
                            data-testid={`range-error-${group.id}-${rangeIndex}`}
                            className="text-body-sm text-destructive flex items-start gap-1.5"
                          >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{err.messages[0]}</span>
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {groupDayErrors.length > 0 && (
                    <p
                      role="alert"
                      data-testid={`day-error-${group.id}`}
                      className="text-body-sm text-destructive flex items-start gap-1.5"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{groupDayErrors[0]}</span>
                    </p>
                  )}

                  {ranges.length < MAX_RANGES_PER_DAY && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRange(group.days)}
                      disabled={disabled}
                      data-testid={`add-range-${group.id}`}
                      className="w-full rounded-xl"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>{labels.addRange}</span>
                    </Button>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>

      <p className="text-body-sm text-muted-foreground px-1">{labels.overnightHint}</p>
    </div>
  );
}
