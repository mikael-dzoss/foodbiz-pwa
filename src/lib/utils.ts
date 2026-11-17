import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SAFE_SPACING = /^safe(-min)?(-\d+(\.\d+)?)?$/;

// Teach tailwind-merge the custom tokens from globals.css, or `text-caption` would be read as a
// colour and dropped next to `text-muted-foreground` (and `pb-safe-4` would not replace `pb-4`).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "display",
        "title-lg",
        "title-md",
        "title-sm",
        "body-md",
        "body-sm",
        "label-md",
        "label-strong",
        "label-sm",
        "caption",
        "micro",
      ],
    },
    classGroups: {
      pb: [{ pb: [(value: string) => SAFE_SPACING.test(value)] }],
      pt: [{ pt: [(value: string) => /^safe-min-\d+(\.\d+)?$/.test(value)] }],
      bottom: [{ bottom: ["sticky-safe", "above-nav"] }],
      w: [{ w: ["screen-gutter"] }],
      "bg-image": [{ bg: ["dot-grid"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
