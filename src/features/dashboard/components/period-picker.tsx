"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { DashboardPeriodPreset } from "@/domain";

export interface PeriodPickerProps {
  value: DashboardPeriodPreset;
  onChange: (value: DashboardPeriodPreset) => void;
  disabled?: boolean;
  className?: string;
  labels: Record<DashboardPeriodPreset, string>;
  ariaLabel: string;
}

const PRESETS: readonly DashboardPeriodPreset[] = [
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
];

export function PeriodPicker({
  value,
  onChange,
  disabled = false,
  className,
  labels,
  ariaLabel,
}: PeriodPickerProps) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as DashboardPeriodPreset)}>
      <TabsList
        aria-label={ariaLabel}
        className={cn(
          "h-auto w-full min-w-0 scrollbar-none justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 py-1",
          className,
        )}
      >
        {PRESETS.map((preset) => (
          <TabsTrigger
            key={preset}
            value={preset}
            aria-controls="kpi-panel"
            disabled={disabled}
            data-testid={`period-tab-${preset}`}
            className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shadow-none transition-all active:scale-95 data-[state=active]:shadow-none"
          >
            {labels[preset]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
