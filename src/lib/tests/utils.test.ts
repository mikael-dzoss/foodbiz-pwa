import { describe, expect, it } from "vitest";
import { cn } from "../utils";

describe("cn utility", () => {
  it("merges class names correctly", () => {
    expect(cn("px-2 py-1", "bg-primary")).toBe("px-2 py-1 bg-primary");
  });

  it("handles conditional classes and falsy values", () => {
    expect(cn("px-2", false && "hidden", null, undefined, "text-sm")).toBe("px-2 text-sm");
  });

  it("resolves tailwind merge conflicts", () => {
    expect(cn("px-2 px-4", "text-sm text-lg")).toBe("px-4 text-lg");
  });

  it("keeps custom type tokens next to text colours and replaces them like font sizes", () => {
    expect(cn("text-caption text-muted-foreground")).toBe("text-caption text-muted-foreground");
    expect(cn("text-title-md text-sm")).toBe("text-sm");
    expect(cn("text-title-sm text-muted-foreground")).toBe("text-title-sm text-muted-foreground");
    expect(cn("text-sm text-label-sm")).toBe("text-label-sm");
  });

  it("lets safe-area padding replace plain padding and itself", () => {
    expect(cn("pb-4", "pb-safe-6")).toBe("pb-safe-6");
    expect(cn("pb-safe-6", "pb-safe-min-4")).toBe("pb-safe-min-4");
    expect(cn("pb-safe", "pb-2")).toBe("pb-2");
    expect(cn("pt-2", "pt-safe-min-3")).toBe("pt-safe-min-3");
  });

  it("treats the custom layout utilities as their base property", () => {
    expect(cn("bottom-4", "bottom-sticky-safe")).toBe("bottom-sticky-safe");
    expect(cn("w-full", "w-screen-gutter")).toBe("w-screen-gutter");
    expect(cn("bg-card", "bg-dot-grid")).toBe("bg-card bg-dot-grid");
  });
});
