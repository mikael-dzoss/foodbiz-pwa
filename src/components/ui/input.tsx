import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  "data-testid"?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, "data-testid": testId, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "bg-card text-foreground placeholder:text-muted-foreground flex h-12 min-h-11 w-full rounded-md border px-3 py-2 text-base",
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
Input.displayName = "Input";
