import * as React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "error" | "warning" | "info";

export type AlertRole = "alert" | "status";

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "role" | "title"> {
  tone: AlertTone;
  /** Optional short heading rendered above the body using the small-heading title role. */
  title?: React.ReactNode;
  /** Optional leading icon override; defaults to a tone-appropriate lucide icon. */
  icon?: React.ReactNode;
  /** Overrides the default live-region role (`error` → `"alert"`, `warning`/`info` → `"status"`). */
  role?: AlertRole | undefined;
  "data-testid"?: string;
}

const toneStyles: Record<AlertTone, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning-soft text-warning-soft-foreground",
  info: "border-primary/30 bg-primary-soft text-primary-soft-foreground",
};

const defaultRoleByTone: Record<AlertTone, AlertRole> = {
  error: "alert",
  warning: "status",
  info: "status",
};

const defaultIconByTone: Record<AlertTone, React.ComponentType<{ className?: string }>> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

/**
 * Inline bordered notice box for storefront and manager views.
 * Never colour-only: always pairs a soft tinted surface with a leading icon.
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { tone, title, icon, role, tabIndex, className, children, "data-testid": testId, ...props },
    ref,
  ) => {
    const DefaultIcon = defaultIconByTone[tone];
    const resolvedRole = role ?? defaultRoleByTone[tone];

    return (
      <div
        ref={ref}
        role={resolvedRole}
        tabIndex={tabIndex}
        data-testid={testId}
        className={cn(
          "text-body-sm flex items-start gap-2 rounded-xl border p-3",
          toneStyles[tone],
          tabIndex !== undefined &&
            "focus-visible:ring-ring focus:outline-hidden focus-visible:ring-2",
          className,
        )}
        {...props}
      >
        <span className="mt-0.5 flex shrink-0" aria-hidden="true">
          {icon ?? <DefaultIcon className="h-4 w-4" />}
        </span>
        <div className={cn("min-w-0 flex-1 wrap-anywhere", title ? "space-y-1" : undefined)}>
          {title ? <div className="text-label-md">{title}</div> : null}
          {children}
        </div>
      </div>
    );
  },
);
Alert.displayName = "Alert";
