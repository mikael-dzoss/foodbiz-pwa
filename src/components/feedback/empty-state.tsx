import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  "data-testid"?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  "data-testid": testId,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-card flex flex-col items-center justify-center rounded-lg border p-8 text-center",
        className,
      )}
      data-testid={testId}
    >
      <div className="bg-muted text-muted-foreground mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-title-md text-foreground font-semibold">{title}</h3>
      {description && (
        <p className="text-body-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && (
        <Button
          type="button"
          onClick={action.onClick}
          className="mt-4"
          data-testid="empty-state-action"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
