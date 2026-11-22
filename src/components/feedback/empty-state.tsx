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
  /** Level of the title heading: 1 when the state is the whole page, 3 (default) inside a section. */
  headingLevel?: 1 | 2 | 3;
  className?: string;
  "data-testid"?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 3,
  className,
  "data-testid": testId,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
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
      <Heading className="text-title-sm text-foreground">{title}</Heading>
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
