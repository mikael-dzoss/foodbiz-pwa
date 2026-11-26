import { describe, expect, it } from "vitest";
import { detectInstallPlatform, isIosUserAgent } from "../platform";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  ipadClassicSafari:
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  macosSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
  iosFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/124.0 Mobile/15E148 Safari/605.1.15",
  iosEdge:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/123.0.2420.65 Mobile/15E148 Safari/605.1.15",
  ipadAsMacChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Safari/605.1.15",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  desktopChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  desktopFirefox:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0",
  windowsEdge:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
  linuxChrome:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

describe("detectInstallPlatform (#100)", () => {
  it("returns standalone whenever the app is already running standalone", () => {
    expect(
      detectInstallPlatform({
        userAgent: UA.iosSafari,
        canPrompt: false,
        isStandalone: true,
      }),
    ).toBe("standalone");
    expect(
      detectInstallPlatform({
        userAgent: UA.androidChrome,
        canPrompt: true,
        isStandalone: true,
      }),
    ).toBe("standalone");
  });

  it("returns native-prompt when beforeinstallprompt is captured on Android or desktop Chromium", () => {
    expect(
      detectInstallPlatform({
        userAgent: UA.androidChrome,
        canPrompt: true,
        isStandalone: false,
      }),
    ).toBe("native-prompt");
    expect(
      detectInstallPlatform({
        userAgent: UA.desktopChrome,
        canPrompt: true,
        isStandalone: false,
      }),
    ).toBe("native-prompt");
    expect(
      detectInstallPlatform({
        userAgent: UA.windowsEdge,
        canPrompt: true,
        isStandalone: false,
      }),
    ).toBe("native-prompt");
  });

  it("detects iOS and iPadOS Safari, including iPadOS reporting as Mac with maxTouchPoints > 1", () => {
    expect(
      detectInstallPlatform({
        userAgent: UA.iosSafari,
        platform: "iPhone",
        maxTouchPoints: 5,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toBe("ios-safari");

    expect(
      detectInstallPlatform({
        userAgent: UA.ipadClassicSafari,
        platform: "iPad",
        maxTouchPoints: 5,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toBe("ios-safari");

    expect(
      detectInstallPlatform({
        userAgent: UA.macosSafari,
        platform: "MacIntel",
        maxTouchPoints: 5,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toBe("ios-safari");

    // Works even when platform is omitted and only UA + maxTouchPoints are available.
    expect(
      detectInstallPlatform({
        userAgent: UA.macosSafari,
        maxTouchPoints: 5,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toBe("ios-safari");
  });

  it("detects non-Safari browsers on iOS and iPadOS", () => {
    for (const userAgent of [UA.iosChrome, UA.iosFirefox, UA.iosEdge]) {
      expect(
        detectInstallPlatform({
          userAgent,
          platform: "iPhone",
          maxTouchPoints: 5,
          canPrompt: false,
          isStandalone: false,
        }),
      ).toBe("ios-other");
    }

    expect(
      detectInstallPlatform({
        userAgent: UA.ipadAsMacChrome,
        platform: "MacIntel",
        maxTouchPoints: 5,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toBe("ios-other");
  });

  it("detects Android without a native prompt (Firefox, Samsung Internet, prompt already used)", () => {
    for (const userAgent of [UA.androidFirefox, UA.androidSamsung, UA.androidChrome]) {
      expect(
        detectInstallPlatform({
          userAgent,
          canPrompt: false,
          isStandalone: false,
        }),
      ).toBe("android-manual");
    }
  });

  it("detects desktop Safari on macOS (without multi-touch iPadOS spoofing)", () => {
    expect(
      detectInstallPlatform({
        userAgent: UA.macosSafari,
        platform: "MacIntel",
        maxTouchPoints: 0,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toBe("macos-safari");

    expect(
      detectInstallPlatform({
        userAgent: UA.macosSafari,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toBe("macos-safari");
  });

  it("falls back to generic guidance on other or unknown browsers", () => {
    for (const input of [
      { userAgent: UA.desktopChrome, platform: "MacIntel", maxTouchPoints: 0 },
      { userAgent: UA.desktopFirefox, platform: "MacIntel", maxTouchPoints: 0 },
      { userAgent: UA.windowsEdge, platform: "Win32", maxTouchPoints: 10 },
      { userAgent: UA.linuxChrome, platform: "Linux x86_64", maxTouchPoints: 0 },
      { userAgent: "", platform: "", maxTouchPoints: 0 },
    ]) {
      expect(
        detectInstallPlatform({
          ...input,
          canPrompt: false,
          isStandalone: false,
        }),
      ).toBe("generic");
    }
  });

  it("exposes isIosUserAgent helper matching iPadOS-as-Mac but not Windows touch laptops", () => {
    expect(
      isIosUserAgent({ userAgent: UA.macosSafari, platform: "MacIntel", maxTouchPoints: 5 }),
    ).toBe(true);
    expect(
      isIosUserAgent({ userAgent: UA.macosSafari, platform: "MacIntel", maxTouchPoints: 0 }),
    ).toBe(false);
    expect(
      isIosUserAgent({ userAgent: UA.windowsEdge, platform: "Win32", maxTouchPoints: 10 }),
    ).toBe(false);
  });
});
