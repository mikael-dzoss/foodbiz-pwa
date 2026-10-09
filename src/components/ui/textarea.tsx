import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  "data-testid"?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, "data-testid": testId, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "bg-card text-foreground placeholder:text-muted-foreground flex min-h-24 w-full rounded-md border px-3 py-2 text-base",
          "border-input focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        ref={ref}
        data-testid={testId}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
