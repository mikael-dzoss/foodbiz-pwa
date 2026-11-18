import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export interface KPICardProps {
  label: string;
  value: string;
  delta?: {
    /** Unsigned size of the change. */
    percentage: number;
    /** Locale-formatted unsigned percentage ("12,4 %"); overrides the plain number. */
    formatted?: string;
    /** Sign of the value change: the arrow and the +/- prefix follow it. */
    direction: "up" | "down" | "flat";
    /** Whether the change is favourable (lower costs are good); only drives the colour. */
    sentiment: "good" | "bad" | "neutral";
    /** Screen-reader reading of direction and sentiment ("Down, favourable"). */
    srLabel?: string;
    periodLabel?: string;
  };
  className?: string;
  "data-testid"?: string;
}

const SENTIMENT_CLASS = {
  good: "bg-primary-soft text-primary-soft-foreground",
  bad: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

const DIRECTION_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const DIRECTION_SIGN = { up: "+", down: "\u2212", flat: "" } as const;

export function KPICard({ label, value, delta, className, "data-testid": testId }: KPICardProps) {
  const DeltaIcon = delta ? DIRECTION_ICON[delta.direction] : null;
  return (
    <Card className={cn("p-4", className)} data-testid={testId}>
      <span className="text-label-sm text-muted-foreground tracking-wider uppercase">{label}</span>
      <div className="text-display text-foreground mt-1 tabular-nums">{value}</div>
      {delta && DeltaIcon && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs",
              SENTIMENT_CLASS[delta.sentiment],
            )}
          >
            <DeltaIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular-nums">
              {DIRECTION_SIGN[delta.direction]}
              {delta.formatted ?? `${delta.percentage}%`}
            </span>
            {delta.srLabel && <span className="sr-only">{delta.srLabel}</span>}
          </span>
          {delta.periodLabel && <span className="text-muted-foreground">{delta.periodLabel}</span>}
        </div>
      )}
    </Card>
  );
}
