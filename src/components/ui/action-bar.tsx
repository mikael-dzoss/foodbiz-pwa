import * as React from "react";
import { cn } from "@/lib/utils";

export type ActionBarPlacement = "above-nav" | "bottom" | "floating";

export interface ActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * `above-nav` (default): fixed above the manager bottom nav, static from `md` where the
   * sidebar replaces it. `bottom`: fixed to the viewport bottom (screens without the nav).
   * `floating`: sticky card at the end of a storefront page.
   */
  placement?: ActionBarPlacement;
  /** Classes for the inner row (width cap, direction). */
  contentClassName?: string;
  "data-testid"?: string;
}

const placementStyles: Record<ActionBarPlacement, string> = {
  "above-nav":
    "border-border bg-card/95 bottom-above-nav fixed inset-x-0 z-30 border-t p-4 shadow-lg backdrop-blur-md md:static md:border-t-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
  bottom:
    "border-border bg-card/95 pb-safe-min-4 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-4 shadow-lg backdrop-blur-md",
  floating:
    "border-border bg-card/95 bottom-sticky-safe sticky z-30 -mt-3 rounded-xl border p-3 shadow-lg backdrop-blur-md dark:shadow-black/40",
};

const contentStyles: Record<ActionBarPlacement, string> = {
  "above-nav": "mx-auto flex max-w-md items-center gap-3",
  bottom: "mx-auto flex max-w-4xl items-center gap-3",
  floating: "mx-auto max-w-4xl",
};

/**
 * The one sticky action bar: form Save/Discard bars and checkout-style summaries. The
 * `above-nav` placement clears the manager bottom nav and the device safe-area inset.
 */
export function ActionBar({
  placement = "above-nav",
  className,
  contentClassName,
  children,
  ...props
}: ActionBarProps) {
  return (
    <div className={cn(placementStyles[placement], className)} {...props}>
      <div className={cn(contentStyles[placement], contentClassName)}>{children}</div>
    </div>
  );
}
