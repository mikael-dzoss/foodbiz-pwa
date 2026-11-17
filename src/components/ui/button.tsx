import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link" | "unstyled";
  size?: "default" | "sm" | "lg" | "icon" | "none";
  loading?: boolean;
  "data-testid"?: string;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90 active:scale-99",
  secondary: "bg-primary-soft text-primary-soft-foreground hover:opacity-90 active:scale-99",
  outline: "border border-border bg-card text-foreground hover:bg-muted active:scale-99",
  ghost: "text-foreground hover:bg-muted active:scale-99",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90 active:scale-99",
  // Bespoke chips, tiles and icon buttons: the caller supplies colours; Button keeps the shared
  // focus ring, disabled handling and test id passthrough.
  unstyled: "",
  link: "text-info underline-offset-4 hover:underline p-0 h-auto min-h-0 min-w-0",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  default: "h-12 px-4 py-2 text-sm min-h-11 min-w-11",
  sm: "h-11 px-3 text-xs min-h-11 min-w-11",
  lg: "h-14 px-8 text-base min-h-11 min-w-11",
  icon: "h-12 w-12 p-0 min-h-11 min-w-11 justify-center",
  // Geometry comes from the caller (bespoke chips, tiles, rows); pair with variant="unstyled".
  none: "",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      loading = false,
      disabled,
      children,
      "data-testid": testId,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // `unstyled` keeps the caller's own display, shape and weight (bespoke chips, rows, tiles).
    const shapeClasses =
      variant === "unstyled"
        ? ""
        : "inline-flex items-center justify-center rounded-md font-medium";
    const baseClasses =
      "select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-all duration-150 motion-reduce:transition-none motion-reduce:active:scale-100";

    return (
      <Comp
        ref={ref}
        className={cn(
          shapeClasses,
          baseClasses,
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={disabled || loading}
        data-testid={testId}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
            <span className="opacity-70">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
