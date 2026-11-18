import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
  /** Required with `onRetry` (translated by the caller). */
  retryLabel?: string;
  /** Level of the title heading: 1 when the state is the whole page, 3 (default) inside a section. */
  headingLevel?: 1 | 2 | 3;
  className?: string;
  "data-testid"?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  headingLevel = 3,
  className,
  "data-testid": testId,
}: ErrorStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/20 bg-destructive/5 flex flex-col items-center justify-center rounded-lg border p-8 text-center",
        className,
      )}
      data-testid={testId}
    >
      <div className="bg-destructive/15 text-destructive mb-3 flex h-12 w-12 items-center justify-center rounded-full">
        <AlertCircle className="h-6 w-6" />
      </div>
      <Heading className="text-title-sm text-foreground">{title}</Heading>
      <p className="text-body-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          className="border-destructive/30 text-destructive hover:bg-destructive/10 mt-4"
          data-testid="error-state-retry"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
