import * as React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

export interface KPICardProps {
  label: string;
  value: string;
  delta?: {
    percentage: number;
    /** Locale-formatted percentage ("12,4 %"); overrides the plain number. */
    formatted?: string;
    isPositive?: boolean;
    periodLabel?: string;
  };
  className?: string;
  "data-testid"?: string;
}

export function KPICard({ label, value, delta, className, "data-testid": testId }: KPICardProps) {
  return (
    <Card className={cn("p-4", className)} data-testid={testId}>
      <span className="text-label-sm text-muted-foreground tracking-wider uppercase">{label}</span>
      <div className="text-display text-foreground mt-1 tabular-nums">{value}</div>
      {delta && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs",
              delta.isPositive
                ? "bg-primary-soft text-primary-soft-foreground"
                : "bg-destructive/15 text-destructive",
            )}
          >
            {delta.isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span className="tabular-nums">
              {delta.isPositive ? "+" : ""}
              {delta.formatted ?? `${delta.percentage}%`}
            </span>
          </span>
          {delta.periodLabel && <span className="text-muted-foreground">{delta.periodLabel}</span>}
        </div>
      )}
    </Card>
  );
}
