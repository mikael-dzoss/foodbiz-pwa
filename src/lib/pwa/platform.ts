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

export type UserAgentInput = Pick<
  InstallPlatformInput,
  "userAgent" | "platform" | "maxTouchPoints"
>;

export type ManualInstallPlatformInput = Pick<
  InstallPlatformInput,
  "userAgent" | "platform" | "maxTouchPoints" | "isStandalone"
>;

const IOS_DEVICE = /iphone|ipad|ipod/i;
const MAC_UA = /macintosh|mac os x/i;
// iOS browsers that advertise a distinct UA token (Chrome, Firefox, Edge, Opera, Yandex).
// Other iOS browsers whose UA looks like Safari receive the Safari guide.
const IOS_OTHER_BROWSER = /crios|fxios|edgios|opios|yabrowser/i;
const NON_SAFARI_DESKTOP = /chrome|chromium|crios|edg|opr|opera|firefox|fxios|samsungbrowser/i;
const ANDROID_WEBVIEW = /;\s*wv\)/i;

// Ordered so specific tokens (e.g. MessengerForiOS / FB_IAB/MESSENGER inside a Meta UA) match first.
const IN_APP_BROWSER_RULES: ReadonlyArray<{ app: InAppBrowserApp; pattern: RegExp }> = [
  { app: "Instagram", pattern: /Instagram/i },
  { app: "Messenger", pattern: /MessengerForiOS|FB_IAB\/MESSENGER/i },
  { app: "Facebook", pattern: /\b(?:FBAN|FBAV|FB_IAB|FB4A)\b/ },
  { app: "TikTok", pattern: /musical_ly|BytedanceWebview|TikTok/i },
  { app: "Snapchat", pattern: /Snapchat/i },
  { app: "LinkedIn", pattern: /LinkedInApp/i },
  { app: "WeChat", pattern: /MicroMessenger/i },
  { app: "Line", pattern: / Line\//i },
  // Best-effort: newer X mobile webviews occasionally omit the legacy `Twitter` token.
  { app: "X", pattern: /Twitter/i },
];

/** Type guard for the in-app browser platform result. */
export function isInAppPlatform(platform: InstallPlatform): platform is InAppInstallPlatform {
  return typeof platform === "object" && platform.kind === "in-app";
}

/** Returns true for iOS/iPadOS devices, including iPadOS reporting a desktop Mac user agent. */
export function isIosUserAgent(input: UserAgentInput): boolean {
  const ua = input.userAgent;
  if (IOS_DEVICE.test(ua)) return true;
  const touchPoints = input.maxTouchPoints ?? 0;
  return touchPoints > 1 && (input.platform === "MacIntel" || MAC_UA.test(ua));
}

function detectInAppOs(input: UserAgentInput): InAppBrowserOs {
  if (isIosUserAgent(input)) return "ios";
  if (/android/i.test(input.userAgent)) return "android";
  return "other";
}

/**
 * Detects embedded in-app browsers (social webviews, Android WebView, iOS WKWebView) that
 * cannot install a PWA and hide Add to Home Screen.
 *
 * Requires `isStandalone` because installed iOS standalone PWAs share the same UA shape as a
 * generic iOS WKWebView (`AppleWebKit/... Mobile/...` without `Safari`); always returns `null`
 * when `isStandalone` is true.
 */
export function detectInAppBrowser(input: ManualInstallPlatformInput): InAppInstallPlatform | null {
  if (input.isStandalone) return null;

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
 * Builds an Android Chrome `intent://` URI from a Location-like object, including
 * `S.browser_fallback_url` so blocked intents fall back to the current page.
 * Derive on the client after mount (never during SSR).
 * Hash fragments are omitted because `#Intent;...;end` occupies the intent URI fragment.
 */
export function buildAndroidChromeIntentUrl(
  location: Pick<Location, "host" | "pathname" | "search"> & { protocol?: string },
): string {
  const rawProtocol = location.protocol?.replace(/:$/, "").toLowerCase();
  const scheme = rawProtocol === "http" || rawProtocol === "https" ? rawProtocol : "https";
  const hostAndPath = `${location.host}${location.pathname}${location.search}`;
  const fallbackUrl = `${scheme}://${hostAndPath}`;
  return `intent://${hostAndPath}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

/**
 * Classifies the manual install guide variant from user-agent, touch and standalone signals.
 * Returns `null` when already running in standalone mode.
 */
export function detectManualPlatform(
  input: ManualInstallPlatformInput,
): ManualInstallPlatform | null {
  if (input.isStandalone) return null;

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
  return detectManualPlatform(input) ?? "standalone";
}
