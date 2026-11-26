import type { SupportedLocale } from "../types";

/** Shared PWA install guidance copy for both the storefront and manager apps (#100). */
export interface InstallGuideDictionary {
  /** Dialog title, e.g. "Install {app}". */
  title: string;
  /** Dialog description explaining what installing does. */
  description: string;
  /** Accessible label for the dialog close icon button. */
  close: string;
  /** Dismiss button label on manual step-by-step variants. */
  done: string;
  /** Primary button label when the native install prompt is available. */
  installButton: string;
  /** Body text shown above the primary button when native prompt is available. */
  nativeBody: string;
  /** Step 1 for iOS/iPadOS Safari (lucide Share icon renders right after). */
  iosSafariStep1: string;
  /** Step 1 for Chrome/Firefox/Edge on iOS/iPadOS (lucide Share icon renders right after). */
  iosOtherStep1: string;
  /** Step 2 shared by iOS Safari and other iOS browsers. */
  iosStep2: string;
  /** Step 3 shared by iOS Safari and other iOS browsers. */
  iosStep3: string;
  /** Step 1 for Android browsers without a captured native prompt. */
  androidStep1: string;
  /** Step 2 for Android browsers without a captured native prompt. */
  androidStep2: string;
  /** Step 3 for Android browsers without a captured native prompt. */
  androidStep3: string;
  /** Step 1 for desktop Safari on macOS. */
  macosSafariStep1: string;
  /** Step 2 for desktop Safari on macOS. */
  macosSafariStep2: string;
  /** Step 3 for desktop Safari on macOS. */
  macosSafariStep3: string;
  /** Short fallback copy for other or unknown browsers. */
  genericBody: string;
  /** Generic host-app phrase substituted into `{inApp}` when the webview app is unknown. */
  inAppGenericName: string;
  /** Localized display labels for detected in-app host apps. */
  inAppApps: {
    Instagram: string;
    Facebook: string;
    Messenger: string;
    TikTok: string;
    Snapchat: string;
    LinkedIn: string;
    WeChat: string;
    Line: string;
    X: string;
  };
  /** Explanation shown above steps when the page is open inside an in-app browser. */
  inAppExplanation: string;
  /** Step 1 for in-app browsers on iOS (lucide Share icon renders right after). */
  inAppIosStep1: string;
  /** Step 2 for in-app browsers on iOS. */
  inAppIosStep2: string;
  /** Step 1 for in-app browsers on Android. */
  inAppAndroidStep1: string;
  /** Step 2 for in-app browsers on Android. */
  inAppAndroidStep2: string;
  /** Step 1 for in-app browsers on other/desktop OSes. */
  inAppOtherStep1: string;
  /** Step 2 for in-app browsers on other/desktop OSes. */
  inAppOtherStep2: string;
  /** Android-only button/link label opening the current page in Chrome via intent://. */
  inAppOpenInChrome: string;
  /** Button label copying the current page URL to the clipboard. */
  inAppCopyLink: string;
  /** Confirmation announced after copying the link succeeds. */
  inAppLinkCopied: string;
  /** Fallback hint shown with a selectable URL field when clipboard access is unavailable. */
  inAppCopyFallback: string;
  /** Accessible label for the read-only URL field shown on clipboard fallback. */
  inAppCopyUrlLabel: string;
}

const en: InstallGuideDictionary = {
  title: "Install {app}",
  description: "Add {app} to your device for quick, full-screen access.",
  close: "Close",
  done: "Got it",
  installButton: "Install",
  nativeBody: "Tap Install below to add {app} to your home screen or desktop.",
  iosSafariStep1: "Tap the Share button in Safari's toolbar.",
  iosOtherStep1: "Tap the Share button in your browser's address bar or toolbar.",
  // Keep quoted labels ("Add to Home Screen" / "Add") aligned with iOS's exact English menu wording.
  iosStep2: "Scroll down and choose “Add to Home Screen”.",
  iosStep3: "Tap “Add” to install {app}.",
  androidStep1: "Open your browser's menu (⋮ or ≡).",
  androidStep2: "Choose “Install app” or “Add to Home screen”.",
  androidStep3: "Confirm to add {app} to your home screen.",
  macosSafariStep1: "In Safari's top menu bar, click “File”.",
  macosSafariStep2: "Choose “Add to Dock…”.",
  macosSafariStep3: "Click “Add” to install {app} in your Dock.",
  genericBody:
    "Open your browser's menu or address bar and choose “Install app” or “Add to Home screen” to install {app}.",
  inAppGenericName: "this app",
  inAppApps: {
    Instagram: "Instagram",
    Facebook: "Facebook",
    Messenger: "Messenger",
    TikTok: "TikTok",
    Snapchat: "Snapchat",
    LinkedIn: "LinkedIn",
    WeChat: "WeChat",
    Line: "Line",
    X: "X",
  },
  inAppExplanation: "This page is open inside {inApp}. To install, open it in your browser.",
  inAppIosStep1: "Tap the ••• (More) button or Share button.",
  inAppIosStep2: "Choose “Open in Safari” or “Open in external browser”.",
  inAppAndroidStep1: "Tap the ⋮ (three-dot) menu in the top corner.",
  inAppAndroidStep2: "Choose “Open in Chrome” or “Open in browser”.",
  inAppOtherStep1: "Open the app's ••• (More) or ⋮ (three-dot) menu.",
  inAppOtherStep2: "Choose “Open in browser”, or copy the link below.",
  inAppOpenInChrome: "Open in Chrome",
  inAppCopyLink: "Copy link",
  inAppLinkCopied: "Link copied. Paste it in your browser.",
  inAppCopyFallback: "Automatic copy is unavailable here. Select and copy the link below:",
  inAppCopyUrlLabel: "Page link to copy",
};

const fr: InstallGuideDictionary = {
  title: "Installer {app}",
  description: "Ajoutez {app} à votre appareil pour un accès rapide en plein écran.",
  close: "Fermer",
  done: "Compris",
  installButton: "Installer",
  nativeBody:
    "Touchez Installer ci-dessous pour ajouter {app} à votre écran d'accueil ou à votre bureau.",
  iosSafariStep1: "Touchez le bouton Partager dans la barre d'outils de Safari.",
  iosOtherStep1:
    "Touchez le bouton Partager dans la barre d'adresse ou d'outils de votre navigateur.",
  // Conserver les libellés « Sur l'écran d'accueil » / « Ajouter » tels qu'affichés dans le menu iOS français.
  iosStep2: "Faites défiler et choisissez « Sur l'écran d'accueil ».",
  iosStep3: "Touchez « Ajouter » pour installer {app}.",
  androidStep1: "Ouvrez le menu de votre navigateur (⋮ ou ≡).",
  androidStep2: "Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
  androidStep3: "Confirmez pour ajouter {app} à votre écran d'accueil.",
  macosSafariStep1: "Dans la barre de menus de Safari, cliquez sur « Fichier ».",
  macosSafariStep2: "Choisissez « Ajouter au Dock… ».",
  macosSafariStep3: "Cliquez sur « Ajouter » pour installer {app} dans votre Dock.",
  genericBody:
    "Ouvrez le menu ou la barre d'adresse de votre navigateur et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil » pour installer {app}.",
  inAppGenericName: "cette application",
  inAppApps: {
    Instagram: "Instagram",
    Facebook: "Facebook",
    Messenger: "Messenger",
    TikTok: "TikTok",
    Snapchat: "Snapchat",
    LinkedIn: "LinkedIn",
    WeChat: "WeChat",
    Line: "Line",
    X: "X",
  },
  inAppExplanation:
    "Cette page est ouverte dans {inApp}. Pour l'installer, ouvrez cette page dans votre navigateur.",
  inAppIosStep1: "Touchez le bouton ••• (Plus) ou le bouton Partager.",
  inAppIosStep2: "Choisissez « Ouvrir dans Safari » ou « Ouvrir dans le navigateur externe ».",
  inAppAndroidStep1: "Touchez le menu ⋮ (trois points) en haut de l'écran.",
  inAppAndroidStep2: "Choisissez « Ouvrir dans Chrome » ou « Ouvrir dans le navigateur ».",
  inAppOtherStep1: "Ouvrez le menu ••• (Plus) ou ⋮ (trois points) de l'application.",
  inAppOtherStep2: "Choisissez « Ouvrir dans le navigateur » ou copiez le lien ci-dessous.",
  inAppOpenInChrome: "Ouvrir dans Chrome",
  inAppCopyLink: "Copier le lien",
  inAppLinkCopied: "Lien copié. Collez-le dans votre navigateur.",
  inAppCopyFallback:
    "La copie automatique n'est pas disponible ici. Sélectionnez et copiez le lien ci-dessous :",
  inAppCopyUrlLabel: "Lien de la page à copier",
};

export const installGuideCopy: Record<SupportedLocale, InstallGuideDictionary> = { en, fr };
