"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DashboardPeriodPreset } from "@/domain";

export interface PeriodPickerProps {
  value: DashboardPeriodPreset;
  onChange: (value: DashboardPeriodPreset) => void;
  disabled?: boolean;
  className?: string;
  labels?: {
    today: string;
    last_7_days: string;
    last_30_days: string;
    this_month: string;
  };
}

const PRESETS: readonly { id: DashboardPeriodPreset; defaultLabel: string }[] = [
  { id: "today", defaultLabel: "Today" },
  { id: "last_7_days", defaultLabel: "7 days" },
  { id: "last_30_days", defaultLabel: "30 days" },
  { id: "this_month", defaultLabel: "This month" },
];

export function PeriodPicker({
  value,
  onChange,
  disabled = false,
  className,
  labels,
}: PeriodPickerProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by time period"
      className={cn("flex scrollbar-none items-center gap-2 overflow-x-auto py-1", className)}
    >
      {PRESETS.map((preset) => {
        const isSelected = value === preset.id;
        const label = labels ? labels[preset.id] : preset.defaultLabel;

        return (
          <button
            key={preset.id}
            role="tab"
            type="button"
            aria-selected={isSelected}
            aria-controls="kpi-panel"
            disabled={disabled}
            data-testid={`period-tab-${preset.id}`}
            onClick={() => onChange(preset.id)}
            className={cn(
              "focus-visible:ring-ring rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              isSelected
                ? "bg-primary text-primary-foreground shadow-none"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground border active:scale-95",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
