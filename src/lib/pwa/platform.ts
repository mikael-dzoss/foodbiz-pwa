/**
 * Pure platform classification for PWA install guidance (#100).
 *
 * In-app browser detection (Instagram, Facebook, etc.) is handled in a follow-up slice.
 */
export type InstallPlatform =
  | "standalone"
  | "native-prompt"
  | "ios-safari"
  | "ios-other"
  | "android-manual"
  | "macos-safari"
  | "generic";

/** Platforms that display install guidance inside the shared dialog. */
export type InstallGuidePlatform = Exclude<InstallPlatform, "standalone">;

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

const IOS_DEVICE = /iphone|ipad|ipod/i;
const MAC_UA = /macintosh|mac os x/i;
const IOS_OTHER_BROWSER = /crios|fxios|edgios|opios|yabrowser|duckduckgo|brave/i;
const NON_SAFARI_DESKTOP = /chrome|chromium|crios|edg|opr|opera|firefox|fxios|samsungbrowser/i;

/** Returns true for iOS/iPadOS devices, including iPadOS reporting a desktop Mac user agent. */
export function isIosUserAgent(
  input: Pick<InstallPlatformInput, "userAgent" | "platform" | "maxTouchPoints">,
): boolean {
  const ua = input.userAgent;
  if (IOS_DEVICE.test(ua)) return true;
  const touchPoints = input.maxTouchPoints ?? 0;
  return touchPoints > 1 && (input.platform === "MacIntel" || MAC_UA.test(ua));
}

/** Maps browser signals to the matching PWA install guidance variant. */
export function detectInstallPlatform(input: InstallPlatformInput): InstallPlatform {
  if (input.isStandalone) return "standalone";
  if (input.canPrompt) return "native-prompt";

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
