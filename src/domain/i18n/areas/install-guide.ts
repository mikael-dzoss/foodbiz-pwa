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
};

export const installGuideCopy: Record<SupportedLocale, InstallGuideDictionary> = { en, fr };
