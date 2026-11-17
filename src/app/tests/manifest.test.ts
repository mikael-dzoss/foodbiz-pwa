import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_METADATA } from "@/config/app";
import manifest from "../manifest";

describe("web app manifest", () => {
  const m = manifest();

  it("installs the manager app", () => {
    expect(m.id).toBe("/manage");
    expect(m.start_url).toBe("/manage");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("uses the light-theme surface colour for chrome and splash", () => {
    expect(m.theme_color).toBe("#f9f9ff");
    expect(m.background_color).toBe("#f9f9ff");
    expect(m.theme_color).toBe(APP_METADATA.themeColor);
  });

  it("only lists icons that exist, with 192, 512 and a maskable variant", () => {
    const icons = m.icons ?? [];
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), "public", icon.src))).toBe(true);
    }
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    const maskable = icons.filter((i) => i.purpose === "maskable");
    expect(maskable.map((i) => i.src)).toEqual(["/icons/icon-maskable-512.png"]);
  });
});
