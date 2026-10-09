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
});
