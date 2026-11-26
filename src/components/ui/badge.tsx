import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "destructive"
    | "info"
    | "warning"
    | "success"
    | "new"
    | "confirmed"
    | "preparing"
    | "ready"
    | "completed"
    | "cancelled"
    | "paid"
    | "unpaid"
    | "refunded";
  "data-testid"?: string;
}

const badgeVariants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground bg-transparent",
  destructive: "bg-destructive text-destructive-foreground",
  info: "bg-info text-info-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  success: "bg-primary-soft text-primary-soft-foreground",
  new: "bg-info text-info-foreground",
  confirmed: "border border-info text-info bg-card",
  preparing: "bg-warning-soft text-warning-soft-foreground",
  ready: "bg-primary-soft text-primary-soft-foreground font-semibold",
  completed: "bg-muted text-muted-foreground",
  cancelled: "border border-destructive text-destructive bg-card",
  paid: "bg-primary-soft text-primary-soft-foreground",
  unpaid: "bg-warning-soft text-warning-soft-foreground",
  refunded: "border border-border bg-muted text-muted-foreground font-medium",
};

export function Badge({
  className,
  variant = "default",
  "data-testid": testId,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium transition-colors",
        badgeVariants[variant],
        className,
      )}
      data-testid={testId}
      {...props}
    />
  );
}
