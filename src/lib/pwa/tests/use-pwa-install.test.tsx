import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetPwaInstallStore } from "../install-store";
import { getManualPlatformSnapshot, usePwaInstall } from "../use-pwa-install";

function Probe() {
  const { platform, isIos, isStandalone, canPrompt } = usePwaInstall();
  return (
    <output data-testid="pwa-probe">
      {JSON.stringify({ platform, isIos, isStandalone, canPrompt })}
    </output>
  );
}

afterEach(() => {
  resetPwaInstallStore();
  vi.unstubAllGlobals();
});

describe("usePwaInstall & getManualPlatformSnapshot (#100)", () => {
  it("detects iPadOS reporting as Mac when navigator has MacIntel and maxTouchPoints > 1", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 5,
    });

    expect(getManualPlatformSnapshot()).toBe("ios-safari");

    render(<Probe />);
    expect(JSON.parse(screen.getByTestId("pwa-probe").textContent ?? "")).toEqual({
      platform: "ios-safari",
      isIos: true,
      isStandalone: false,
      canPrompt: false,
    });
  });

  it("falls back to generic when navigator is undefined (SSR)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(getManualPlatformSnapshot()).toBe("generic");
  });

  it("renders the SSR server snapshot as generic without reading navigator", () => {
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain("&quot;platform&quot;:&quot;generic&quot;");
    expect(html).toContain("&quot;isIos&quot;:false");
    expect(html).toContain("&quot;isStandalone&quot;:false");
  });

  it("transitions from native-prompt to manual platform after dismissal and standalone after accept", async () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    });

    render(<Probe />);
    expect(JSON.parse(screen.getByTestId("pwa-probe").textContent ?? "").platform).toBe(
      "android-manual",
    );

    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(JSON.parse(screen.getByTestId("pwa-probe").textContent ?? "").platform).toBe(
      "native-prompt",
    );

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(JSON.parse(screen.getByTestId("pwa-probe").textContent ?? "")).toEqual({
      platform: "standalone",
      isIos: false,
      isStandalone: true,
      canPrompt: false,
    });
  });

  it("exposes a stable in-app platform snapshot that beats native-prompt but yields to standalone", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.0.0 Mobile Safari/537.36 Instagram 324.0.0.34.97",
      platform: "Linux armv8l",
      maxTouchPoints: 5,
    });

    const first = getManualPlatformSnapshot();
    const second = getManualPlatformSnapshot();
    expect(first).toBe(second);
    expect(first).toEqual({ kind: "in-app", os: "android", app: "Instagram" });

    render(<Probe />);
    expect(JSON.parse(screen.getByTestId("pwa-probe").textContent ?? "").platform).toEqual({
      kind: "in-app",
      os: "android",
      app: "Instagram",
    });

    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(JSON.parse(screen.getByTestId("pwa-probe").textContent ?? "").platform).toEqual({
      kind: "in-app",
      os: "android",
      app: "Instagram",
    });

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(JSON.parse(screen.getByTestId("pwa-probe").textContent ?? "").platform).toBe(
      "standalone",
    );
  });
});
