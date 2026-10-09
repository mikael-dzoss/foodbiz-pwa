import * as React from "react";
import { cn } from "@/lib/utils";

export interface SoonBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label?: string;
  "data-testid"?: string;
}

export function SoonBadge({
  label = "Soon",
  className,
  "data-testid": testId,
  ...props
}: SoonBadgeProps) {
  return (
    <span
      className={cn(
        "border-border bg-muted text-label-sm text-muted-foreground inline-flex items-center rounded border px-2 py-0.5 font-medium",
        className,
      )}
      data-testid={testId}
      {...props}
    >
      {label}
    </span>
  );
}
