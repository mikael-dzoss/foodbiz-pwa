// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { describe, expect, it } from "vitest";
import { APP_METADATA } from "@/config/app";
import { GET } from "../route";

describe("GET /manage/manifest.webmanifest", () => {
  it("returns 200 with application/manifest+json and manager PWA fields", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/manifest+json");

    const body = (await response.json()) as MetadataRoute.Manifest;
    expect(body.id).toBe("/manage");
    expect(body.start_url).toBe("/manage");
    expect(body.scope).toBe("/manage");
    // start_url must be within scope (path prefix) or browsers ignore the scope.
    expect(body.start_url?.startsWith(body.scope ?? "")).toBe(true);
    expect(body.name).toBe("FoodBiz Manager");
    expect(body.short_name).toBe("FoodBiz");
    expect(body.description).toBe(APP_METADATA.manager.description);
    expect(body.display).toBe("standalone");
    expect(body.orientation).toBe("portrait");
    expect(body.theme_color).toBe("#f9f9ff");
    expect(body.background_color).toBe("#f9f9ff");
    expect(body.theme_color).toBe(APP_METADATA.themeColor);
  });

  it("only lists icons that exist, with 192, 512 and a maskable variant", async () => {
    const body = (await GET().json()) as MetadataRoute.Manifest;
    const icons = body.icons ?? [];
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
