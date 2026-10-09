import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Typography with Inter (#27)", () => {
  it("loads Inter with latin and latin-ext in layout.tsx", () => {
    const layoutContent = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf-8");
    expect(layoutContent).toContain('import { Inter } from "next/font/google"');
    expect(layoutContent).toContain('"latin"');
    expect(layoutContent).toContain('"latin-ext"');
    expect(layoutContent).not.toContain("Geist");
    expect(layoutContent).not.toContain("Geist_Mono");
  });

  it("configures font-sans and type scale classes in globals.css", () => {
    const cssContent = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf-8");
    expect(cssContent).toContain("--font-sans: var(--font-sans), sans-serif");
    expect(cssContent).toContain(".text-display");
    expect(cssContent).toContain(".text-title-lg");
    expect(cssContent).toContain(".text-title-md");
    expect(cssContent).toContain(".text-body-md");
    expect(cssContent).toContain(".text-body-sm");
    expect(cssContent).toContain(".text-label-md");
    expect(cssContent).toContain(".text-label-sm");
    expect(cssContent).toContain(".tabular-nums");
    expect(cssContent).toContain('font-feature-settings: "tnum" 1');
  });
});
