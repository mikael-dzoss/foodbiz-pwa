import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  "data-testid"?: string;
}

/**
 * Styled native `<select>`: the OS picker on phones. Use it for short, plain option lists in
 * forms; use the Radix `Select` when the list needs custom rendering.
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, error, children, "data-testid": testId, ...props }, ref) => (
    <div className="relative w-full">
      <select
        ref={ref}
        data-testid={testId}
        className={cn(
          "border-input bg-card text-foreground focus-visible:ring-ring h-12 min-h-11 w-full appearance-none rounded-md border py-2 pr-9 pl-3 text-base",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2"
      />
    </div>
  ),
);
NativeSelect.displayName = "NativeSelect";
