import { describe, expect, it } from "vitest";
import {
  buildAndroidChromeIntentUrl,
  detectInAppBrowser,
  detectInstallPlatform,
  detectManualPlatform,
  isInAppPlatform,
  isIosUserAgent,
  type InAppBrowserApp,
} from "../platform";

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

  it("exposes detectManualPlatform directly for UA + standalone classification", () => {
    expect(
      detectManualPlatform({
        userAgent: UA.macosSafari,
        platform: "MacIntel",
        maxTouchPoints: 5,
        isStandalone: false,
      }),
    ).toBe("ios-safari");
    expect(detectManualPlatform({ userAgent: UA.iosChrome, isStandalone: false })).toBe(
      "ios-other",
    );
    expect(detectManualPlatform({ userAgent: UA.androidFirefox, isStandalone: false })).toBe(
      "android-manual",
    );
    expect(
      detectManualPlatform({
        userAgent: UA.macosSafari,
        platform: "MacIntel",
        maxTouchPoints: 0,
        isStandalone: false,
      }),
    ).toBe("macos-safari");
    expect(detectManualPlatform({ userAgent: UA.linuxChrome, isStandalone: false })).toBe(
      "generic",
    );
    expect(detectManualPlatform({ userAgent: UA.iosSafari, isStandalone: true })).toBeNull();
  });
});

const IOS_BASE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219";
const ANDROID_BASE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240305.019.A1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/123.0.6312.40 Mobile Safari/537.36";

const IN_APP_TOKEN_CASES: ReadonlyArray<{
  token: string;
  expectedApp: InAppBrowserApp;
  iosUa: string;
  androidUa: string;
}> = [
  {
    token: "Instagram",
    expectedApp: "Instagram",
    iosUa: `${IOS_BASE} Instagram 324.0.0.21.106 (iPhone15,2; iOS 17_4; en_US)`,
    androidUa: `${ANDROID_BASE} Instagram 324.0.0.34.97 Android`,
  },
  {
    token: "FBAN",
    expectedApp: "Facebook",
    iosUa: `${IOS_BASE} [FBAN/FBIOS;FBDV/iPhone15,2]`,
    androidUa: `${ANDROID_BASE} [FBAN/Orca-Android]`,
  },
  {
    token: "FBAV",
    expectedApp: "Facebook",
    iosUa: `${IOS_BASE} [FBAV/456.0.0.48.107]`,
    androidUa: `${ANDROID_BASE} [FBAV/456.0.0.39.109]`,
  },
  {
    token: "FB_IAB",
    expectedApp: "Facebook",
    iosUa: `${IOS_BASE} [FB_IAB/FBIOS]`,
    androidUa: `${ANDROID_BASE} [FB_IAB/Web]`,
  },
  {
    token: "FB4A",
    expectedApp: "Facebook",
    iosUa: `${IOS_BASE} [FB4A/456.0]`,
    androidUa: `${ANDROID_BASE} [FB4A/456.0]`,
  },
  {
    token: "MessengerForiOS",
    expectedApp: "Messenger",
    iosUa: `${IOS_BASE} [FBAN/MessengerForiOS;FBAV/450.0.0.35.107]`,
    androidUa: `${ANDROID_BASE} MessengerForiOS/450.0`,
  },
  {
    token: "FB_IAB/MESSENGER",
    expectedApp: "Messenger",
    iosUa: `${IOS_BASE} [FB_IAB/MESSENGER;FBAV/450.0.0.35.107]`,
    androidUa: `${ANDROID_BASE} [FB_IAB/MESSENGER;FBAV/450.0.0.28.109]`,
  },
  {
    token: "musical_ly",
    expectedApp: "TikTok",
    iosUa: `${IOS_BASE} musical_ly_33.8.0`,
    androidUa: `${ANDROID_BASE} musical_ly_2023308040 AppName/musical_ly`,
  },
  {
    token: "BytedanceWebview",
    expectedApp: "TikTok",
    iosUa: `${IOS_BASE} BytedanceWebview/d8a21c6`,
    androidUa: `${ANDROID_BASE} BytedanceWebview/d8a21c6`,
  },
  {
    token: "TikTok",
    expectedApp: "TikTok",
    iosUa: `${IOS_BASE} TikTok/33.8.0`,
    androidUa: `${ANDROID_BASE} TikTok/33.8.4`,
  },
  {
    token: "Snapchat",
    expectedApp: "Snapchat",
    iosUa: `${IOS_BASE} Version/17.4 Snapchat/12.78.0.42 (like Safari/8617.2.4.10.8)`,
    androidUa: `${ANDROID_BASE} Snapchat/12.78.0.42`,
  },
  {
    token: "LinkedInApp",
    expectedApp: "LinkedIn",
    iosUa: `${IOS_BASE} [LinkedInApp]/9.29.2206`,
    androidUa: `${ANDROID_BASE} [LinkedInApp]`,
  },
  {
    token: "MicroMessenger",
    expectedApp: "WeChat",
    iosUa: `${IOS_BASE} MicroMessenger/8.0.47`,
    androidUa: `${ANDROID_BASE} MicroMessenger/8.0.47.2560`,
  },
  {
    token: " Line/",
    expectedApp: "Line",
    iosUa: `${IOS_BASE} Safari Line/14.3.0`,
    androidUa: `${ANDROID_BASE} Line/14.3.0`,
  },
  {
    token: "Twitter",
    expectedApp: "X",
    iosUa: `${IOS_BASE} Twitter for iPhone`,
    androidUa: `${ANDROID_BASE} TwitterAndroid`,
  },
];

describe("in-app browser detection (#100 slice b)", () => {
  it.each(IN_APP_TOKEN_CASES)(
    "detects $token on iOS and Android UAs as $expectedApp",
    ({ expectedApp, iosUa, androidUa }) => {
      const iosResult = detectInstallPlatform({
        userAgent: iosUa,
        platform: "iPhone",
        maxTouchPoints: 5,
        canPrompt: false,
        isStandalone: false,
      });
      expect(iosResult).toEqual({ kind: "in-app", os: "ios", app: expectedApp });
      expect(isInAppPlatform(iosResult)).toBe(true);

      const androidResult = detectInstallPlatform({
        userAgent: androidUa,
        canPrompt: false,
        isStandalone: false,
      });
      expect(androidResult).toEqual({ kind: "in-app", os: "android", app: expectedApp });
      expect(isInAppPlatform(androidResult)).toBe(true);
    },
  );

  it("checks in-app after standalone but before native-prompt and other platforms", () => {
    const instagramAndroid = `${ANDROID_BASE} Instagram 324.0.0.34.97`;

    expect(
      detectInstallPlatform({
        userAgent: instagramAndroid,
        canPrompt: true,
        isStandalone: true,
      }),
    ).toBe("standalone");

    expect(
      detectInstallPlatform({
        userAgent: instagramAndroid,
        canPrompt: true,
        isStandalone: false,
      }),
    ).toEqual({ kind: "in-app", os: "android", app: "Instagram" });
  });

  it("detects generic Android WebView and iOS WKWebView with app = null", () => {
    expect(
      detectInstallPlatform({
        userAgent: ANDROID_BASE,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toEqual({ kind: "in-app", os: "android", app: null });

    expect(
      detectInstallPlatform({
        userAgent: IOS_BASE,
        platform: "iPhone",
        maxTouchPoints: 5,
        canPrompt: false,
        isStandalone: false,
      }),
    ).toEqual({ kind: "in-app", os: "ios", app: null });
  });

  it("never classifies an installed standalone iOS PWA UA (AppleWebKit + Mobile/ without Safari) as in-app", () => {
    const standaloneIosInput = {
      userAgent: IOS_BASE,
      platform: "iPhone",
      maxTouchPoints: 5,
      isStandalone: true,
    };

    expect(detectInAppBrowser(standaloneIosInput)).toBeNull();
    expect(detectManualPlatform(standaloneIosInput)).toBeNull();
    expect(
      detectInstallPlatform({
        ...standaloneIosInput,
        canPrompt: false,
      }),
    ).toBe("standalone");
  });

  it("reports os = other for desktop in-app UAs", () => {
    expect(
      detectInAppBrowser({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 MicroMessenger/3.8.0",
        platform: "MacIntel",
        maxTouchPoints: 0,
        isStandalone: false,
      }),
    ).toEqual({ kind: "in-app", os: "other", app: "WeChat" });
  });

  it("does NOT classify plain Safari, Chrome, Firefox, Edge, Samsung Internet or substrings like Online/ as in-app", () => {
    for (const input of [
      { userAgent: UA.iosSafari, platform: "iPhone", maxTouchPoints: 5 },
      { userAgent: UA.ipadClassicSafari, platform: "iPad", maxTouchPoints: 5 },
      { userAgent: UA.macosSafari, platform: "MacIntel", maxTouchPoints: 5 },
      { userAgent: UA.macosSafari, platform: "MacIntel", maxTouchPoints: 0 },
      { userAgent: UA.iosChrome, platform: "iPhone", maxTouchPoints: 5 },
      { userAgent: UA.iosFirefox, platform: "iPhone", maxTouchPoints: 5 },
      { userAgent: UA.iosEdge, platform: "iPhone", maxTouchPoints: 5 },
      { userAgent: UA.androidChrome },
      { userAgent: UA.androidFirefox },
      { userAgent: UA.androidSamsung },
      { userAgent: UA.desktopChrome },
      { userAgent: UA.desktopFirefox },
      { userAgent: UA.windowsEdge },
      { userAgent: UA.linuxChrome },
      { userAgent: `${UA.androidChrome} Online/1.0 Timeline/2.0` },
    ]) {
      expect(detectInAppBrowser({ ...input, isStandalone: false })).toBeNull();
    }
    expect(isInAppPlatform("ios-safari")).toBe(false);
    expect(isInAppPlatform("android-manual")).toBe(false);
  });

  it("builds Android Chrome intent URIs deriving scheme from protocol (defaulting to https) with S.browser_fallback_url", () => {
    expect(
      buildAndroidChromeIntentUrl({
        protocol: "https:",
        host: "shop.example.com",
        pathname: "/en/menu",
        search: "?cat=mains",
      }),
    ).toBe(
      `intent://shop.example.com/en/menu?cat=mains#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent("https://shop.example.com/en/menu?cat=mains")};end`,
    );

    expect(
      buildAndroidChromeIntentUrl({
        protocol: "http:",
        host: "localhost:3000",
        pathname: "/fr",
        search: "",
      }),
    ).toBe(
      `intent://localhost:3000/fr#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent("http://localhost:3000/fr")};end`,
    );

    // Defaults to https when protocol is omitted or non-http(s).
    expect(
      buildAndroidChromeIntentUrl({
        host: "shop.example.com",
        pathname: "/fr",
        search: "",
      }),
    ).toBe(
      `intent://shop.example.com/fr#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent("https://shop.example.com/fr")};end`,
    );
  });
});
