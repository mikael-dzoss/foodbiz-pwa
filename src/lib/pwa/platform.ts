/**
 * Pure platform classification for PWA install guidance (#100).
 */
export type InAppBrowserApp =
  | "Instagram"
  | "Facebook"
  | "Messenger"
  | "TikTok"
  | "Snapchat"
  | "LinkedIn"
  | "WeChat"
  | "Line"
  | "X";

export type InAppBrowserOs = "ios" | "android" | "other";

export interface InAppInstallPlatform {
  readonly kind: "in-app";
  readonly os: InAppBrowserOs;
  readonly app: InAppBrowserApp | null;
}

export type InstallPlatform =
  | "standalone"
  | "native-prompt"
  | "ios-safari"
  | "ios-other"
  | "android-manual"
  | "macos-safari"
  | "generic"
  | InAppInstallPlatform;

/** Platforms that display install guidance inside the shared dialog. */
export type InstallGuidePlatform = Exclude<InstallPlatform, "standalone">;

/** Fallback platforms detected purely from navigator/user-agent signals (no native prompt). */
export type ManualInstallPlatform = Exclude<InstallPlatform, "standalone" | "native-prompt">;

export interface InstallPlatformInput {
  userAgent: string;
  /** `navigator.platform` when available (paired with `maxTouchPoints` for iPadOS desktop UA). */
  platform?: string;
  /** `navigator.maxTouchPoints` when available (`> 1` on Mac UA identifies iPadOS). */
  maxTouchPoints?: number;
  /** Whether a deferred `beforeinstallprompt` event is currently available. */
  canPrompt: boolean;
  /** Whether the app is already running in standalone display mode (or just installed). */
  isStandalone: boolean;
}

export type ManualInstallPlatformInput = Pick<
  InstallPlatformInput,
  "userAgent" | "platform" | "maxTouchPoints"
>;

const IOS_DEVICE = /iphone|ipad|ipod/i;
const MAC_UA = /macintosh|mac os x/i;
// iOS browsers that advertise a distinct UA token (Chrome, Firefox, Edge, Opera, Yandex).
// Other iOS browsers whose UA looks like Safari receive the Safari guide.
const IOS_OTHER_BROWSER = /crios|fxios|edgios|opios|yabrowser/i;
const NON_SAFARI_DESKTOP = /chrome|chromium|crios|edg|opr|opera|firefox|fxios|samsungbrowser/i;
const ANDROID_WEBVIEW = /;\s*wv\)/i;

// Ordered so specific tokens (e.g. MessengerForiOS inside a Meta FBAN UA) match first.
const IN_APP_BROWSER_RULES: ReadonlyArray<{ app: InAppBrowserApp; pattern: RegExp }> = [
  { app: "Instagram", pattern: /Instagram/i },
  { app: "Messenger", pattern: /MessengerForiOS/i },
  { app: "Facebook", pattern: /\b(?:FBAN|FBAV|FB_IAB|FB4A)\b/ },
  { app: "TikTok", pattern: /musical_ly|BytedanceWebview|TikTok/i },
  { app: "Snapchat", pattern: /Snapchat/i },
  { app: "LinkedIn", pattern: /LinkedInApp/i },
  { app: "WeChat", pattern: /MicroMessenger/i },
  { app: "Line", pattern: / Line\//i },
  { app: "X", pattern: /Twitter/i },
];

/** Type guard for the in-app browser platform result. */
export function isInAppPlatform(platform: InstallPlatform): platform is InAppInstallPlatform {
  return typeof platform === "object" && platform.kind === "in-app";
}

/** Returns true for iOS/iPadOS devices, including iPadOS reporting a desktop Mac user agent. */
export function isIosUserAgent(input: ManualInstallPlatformInput): boolean {
  const ua = input.userAgent;
  if (IOS_DEVICE.test(ua)) return true;
  const touchPoints = input.maxTouchPoints ?? 0;
  return touchPoints > 1 && (input.platform === "MacIntel" || MAC_UA.test(ua));
}

function detectInAppOs(input: ManualInstallPlatformInput): InAppBrowserOs {
  if (isIosUserAgent(input)) return "ios";
  if (/android/i.test(input.userAgent)) return "android";
  return "other";
}

/**
 * Detects embedded in-app browsers (social webviews, Android WebView, iOS WKWebView) that
 * cannot install a PWA and hide Add to Home Screen.
 */
export function detectInAppBrowser(input: ManualInstallPlatformInput): InAppInstallPlatform | null {
  const ua = input.userAgent;
  const os = detectInAppOs(input);

  for (const rule of IN_APP_BROWSER_RULES) {
    if (rule.pattern.test(ua)) {
      return Object.freeze({ kind: "in-app", os, app: rule.app });
    }
  }

  if (os === "android" && ANDROID_WEBVIEW.test(ua)) {
    return Object.freeze({ kind: "in-app", os: "android", app: null });
  }

  if (
    os === "ios" &&
    /AppleWebKit/i.test(ua) &&
    /Mobile\//i.test(ua) &&
    !/Safari/i.test(ua) &&
    !IOS_OTHER_BROWSER.test(ua)
  ) {
    return Object.freeze({ kind: "in-app", os: "ios", app: null });
  }

  return null;
}

/**
 * Builds an Android Chrome `intent://` URI from a Location-like object.
 * Invoke at click time from `window.location` rather than during render/SSR.
 * Hash fragments are omitted because `#Intent;...;end` occupies the intent URI fragment.
 */
export function buildAndroidChromeIntentUrl(
  location: Pick<Location, "host" | "pathname" | "search">,
): string {
  return `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;
}

/** Classifies the manual install guide variant purely from user-agent and touch signals. */
export function detectManualPlatform(input: ManualInstallPlatformInput): ManualInstallPlatform {
  const inApp = detectInAppBrowser(input);
  if (inApp) return inApp;

  const ua = input.userAgent;
  if (isIosUserAgent(input)) {
    const isSafari = /safari/i.test(ua) && /version\//i.test(ua) && !IOS_OTHER_BROWSER.test(ua);
    return isSafari ? "ios-safari" : "ios-other";
  }

  if (/android/i.test(ua)) {
    return "android-manual";
  }

  if (
    MAC_UA.test(ua) &&
    /safari/i.test(ua) &&
    /version\//i.test(ua) &&
    !NON_SAFARI_DESKTOP.test(ua)
  ) {
    return "macos-safari";
  }

  return "generic";
}

/** Maps browser signals to the matching PWA install guidance variant. */
export function detectInstallPlatform(input: InstallPlatformInput): InstallPlatform {
  if (input.isStandalone) return "standalone";
  const inApp = detectInAppBrowser(input);
  if (inApp) return inApp;
  if (input.canPrompt) return "native-prompt";
  return detectManualPlatform(input);
}
