import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  onClick?: () => void;
  "data-testid"?: string;
}

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  showChevron = true,
  onClick,
  className,
  "data-testid": testId,
  ...props
}: ListRowProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "border-border bg-card flex min-h-14 items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors",
        isClickable &&
          "hover:bg-muted/50 active:bg-muted focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
      data-testid={testId}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-body-md text-foreground truncate font-medium">{title}</div>
          {subtitle && (
            <div className="text-body-sm text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {trailing && (
          <div className="text-body-md text-foreground font-medium tabular-nums">{trailing}</div>
        )}
        {showChevron && isClickable && <ChevronRight className="text-muted-foreground h-5 w-5" />}
      </div>
    </div>
  );
}
