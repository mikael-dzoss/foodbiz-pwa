"use client";

import { useMemo, useRef, useState } from "react";
import { getDictionary, type SupportedLocale } from "@/domain/i18n";
import {
  DAY_KEYS,
  MAX_RANGES_PER_DAY,
  weeklyHoursSchema,
  type DayKey,
  type TimeRange,
  type WeeklyHours,
} from "@/domain/opening-hours";
import { SegmentedControl, Switch } from "@/components/ui";
import { interpolate } from "@/domain/i18n";
import {
  DEFAULT_OPEN_RANGE,
  DayRangesEditor,
  addRangeIssue,
  cloneRanges,
  dayIssueMessage,
  nextDefaultRange,
  type DayRangesEditorLabels,
  type RangeValidationError,
} from "./day-ranges-editor";
import { cn } from "@/lib/utils";

export type WeeklyHoursPresetMode = "every_day" | "weekdays_weekend" | "custom";

export interface WeeklyHoursEditorLabels extends DayRangesEditorLabels {
  presetLabel: string;
  presetEveryDay: string;
  presetWeekdaysWeekend: string;
  presetCustom: string;
  groupEveryDay: string;
  groupWeekdays: string;
  groupWeekend: string;
  open: string;
  closed: string;
  toggleDayAria: string;
  overnightHint: string;
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
const EMPTY_RANGE_ERRORS: ReadonlyMap<number, RangeValidationError> = new Map();

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

interface ParsedValidation {
  rangeErrors: Map<DayKey, Map<number, RangeValidationError>>;
  dayErrors: Map<DayKey, string[]>;
}

function buildValidationMap(hours: WeeklyHours, labels: WeeklyHoursEditorLabels): ParsedValidation {
  const rangeErrors = new Map<DayKey, Map<number, RangeValidationError>>();
  const dayErrors = new Map<DayKey, string[]>();

  const parsed = weeklyHoursSchema.safeParse(hours);
  if (parsed.success) return { rangeErrors, dayErrors };

  for (const issue of parsed.error.issues) {
    const dayKey = issue.path[0];
    if (typeof dayKey !== "string" || !(DAY_KEYS as readonly string[]).includes(dayKey)) continue;
    const typedDay = dayKey as DayKey;
    const rangeIndex = issue.path[1];

    if (typeof rangeIndex === "number") {
      const forDay = rangeErrors.get(typedDay) ?? new Map<number, RangeValidationError>();
      addRangeIssue(forDay, rangeIndex, issue.path[2], issue.code, labels);
      rangeErrors.set(typedDay, forDay);
    } else {
      const list = dayErrors.get(typedDay) ?? [];
      const message = dayIssueMessage(issue.code, labels);
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
    rangeAria: oh.rangeAria,
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
  const labels = useMemo(
    () => providedLabels ?? defaultEditorLabels(locale),
    [providedLabels, locale],
  );
  const [mode, setMode] = useState<WeeklyHoursPresetMode>(() => detectPresetMode(value));
  const customHoursRef = useRef<WeeklyHours | null>(null);
  const presetResultRef = useRef<string | null>(null);
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
    if (nextMode === mode) return;
    const leavingCustom = mode === "custom";
    const customSnapshot = leavingCustom ? cloneWeeklyHours(value) : null;
    setMode(nextMode);

    if (nextMode === "custom") {
      // Restore the previous custom schedule when nothing changed since leaving it.
      const saved = customHoursRef.current;
      if (saved && JSON.stringify(value) === presetResultRef.current) {
        onChange(cloneWeeklyHours(saved));
      }
      return;
    }

    let next = value;
    if (nextMode === "every_day") {
      const templateDay = DAY_KEYS.find((day) => value[day].length > 0) ?? "mon";
      const template = value[templateDay];
      if (!DAY_KEYS.every((day) => sameRanges(value[day], template))) {
        next = cloneWeeklyHours(value);
        for (const day of DAY_KEYS) next[day] = cloneRanges(template);
      }
    } else {
      const weekdayTemplateDay = WEEKDAY_KEYS.find((day) => value[day].length > 0) ?? "mon";
      const weekendTemplateDay = WEEKEND_KEYS.find((day) => value[day].length > 0) ?? "sat";
      const weekdayTemplate = value[weekdayTemplateDay];
      const weekendTemplate = value[weekendTemplateDay];
      next = cloneWeeklyHours(value);
      for (const day of WEEKDAY_KEYS) next[day] = cloneRanges(weekdayTemplate);
      for (const day of WEEKEND_KEYS) next[day] = cloneRanges(weekendTemplate);
    }
    if (customSnapshot) {
      customHoursRef.current = customSnapshot;
      presetResultRef.current = JSON.stringify(next);
    }
    if (next !== value) onChange(next);
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
                <DayRangesEditor
                  ranges={ranges}
                  rangeErrors={validation.rangeErrors.get(representativeDay) ?? EMPTY_RANGE_ERRORS}
                  dayErrors={groupDayErrors}
                  groupId={group.id}
                  groupLabel={group.label}
                  labels={labels}
                  disabled={disabled}
                  onRangeChange={(rangeIndex, field, newVal) =>
                    handleRangeChange(group.days, rangeIndex, field, newVal)
                  }
                  onAddRange={() => handleAddRange(group.days)}
                  onRemoveRange={(rangeIndex) => handleRemoveRange(group, rangeIndex)}
                />
              )}
            </fieldset>
          );
        })}
      </div>

      <p className="text-body-sm text-muted-foreground px-1">{labels.overnightHint}</p>
    </div>
  );
}
