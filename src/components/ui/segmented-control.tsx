"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  /**
   * Announced as unavailable (`aria-disabled`) but still focusable and reachable with the arrow
   * keys; selecting it calls `onValueChange` so the caller can explain why (for example a toast).
   */
  unavailable?: boolean;
  "data-testid"?: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  "aria-label": string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  disabled?: boolean;
  className?: string;
  optionClassName?: string;
  selectedClassName?: string;
  idleClassName?: string;
  "data-testid"?: string;
}

/**
 * Radio group rendered as segments: `role="radiogroup"` with a roving tabindex. Arrow keys
 * (and Home/End) move the selection like native radios; disabled options are skipped.
 */
export function SegmentedControl<T extends string>({
  "aria-label": ariaLabel,
  value,
  onValueChange,
  options,
  disabled = false,
  className,
  optionClassName,
  selectedClassName = "bg-card text-foreground shadow-xs",
  idleClassName = "text-muted-foreground hover:text-foreground",
  "data-testid": testId,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<Map<T, HTMLButtonElement>>(new Map());
  const enabled = options.filter((option) => !disabled && !option.disabled);
  const tabStop = enabled.find((option) => option.value === value) ?? enabled[0];

  const move = (from: T, key: string): boolean => {
    const index = enabled.findIndex((option) => option.value === from);
    if (index < 0) return false;
    let target: SegmentedOption<T> | undefined;
    if (key === "ArrowRight" || key === "ArrowDown") target = enabled[(index + 1) % enabled.length];
    else if (key === "ArrowLeft" || key === "ArrowUp")
      target = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (key === "Home") target = enabled[0];
    else if (key === "End") target = enabled[enabled.length - 1];
    if (!target) return false;
    refs.current.get(target.value)?.focus();
    onValueChange(target.value);
    return true;
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn("bg-muted flex gap-1 rounded-xl p-1", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const isDisabled = disabled || option.disabled;
        return (
          <button
            key={option.value}
            ref={(node) => {
              if (node) refs.current.set(option.value, node);
              else refs.current.delete(option.value);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={tabStop?.value === option.value ? 0 : -1}
            disabled={isDisabled}
            aria-disabled={option.unavailable || undefined}
            data-testid={option["data-testid"]}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => {
              if (move(option.value, event.key)) event.preventDefault();
            }}
            className={cn(
              "focus-visible:ring-ring inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed motion-reduce:transition-none",
              selected ? selectedClassName : idleClassName,
              optionClassName,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
