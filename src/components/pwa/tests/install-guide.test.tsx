import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enDictionary, frDictionary } from "@/domain/i18n";
import type { InstallGuidePlatform } from "@/lib/pwa/platform";
import { InstallGuide } from "../install-guide";

const enCopy = enDictionary.installGuide;
const frCopy = frDictionary.installGuide;

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function stubClipboard(value: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  vi.restoreAllMocks();
});

describe("InstallGuide (#100)", () => {
  it("renders nothing when already running standalone", () => {
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="FoodBiz Manager"
        platform="standalone"
        copy={enCopy}
      />,
    );
    expect(screen.queryByTestId("install-guide")).toBeNull();
  });

  it("renders a primary Install button for native-prompt and calls onInstall", () => {
    const onInstall = vi.fn();
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform="native-prompt"
        copy={enCopy}
        onInstall={onInstall}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Install Les Saveurs du Continent" });
    expect(dialog).toBe(screen.getByTestId("install-guide"));
    expect(screen.getByTestId("install-guide-native-prompt").textContent).toContain(
      "Les Saveurs du Continent",
    );

    const installBtn = screen.getByTestId("install-guide-install-button");
    fireEvent.click(installBtn);
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("shows Safari toolbar Share steps with the lucide Share glyph on iOS Safari", () => {
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="FoodBiz Manager"
        platform="ios-safari"
        copy={enCopy}
      />,
    );

    const list = screen.getByTestId("install-guide-ios-safari");
    expect(list.tagName).toBe("OL");
    expect(list.textContent).toContain(enCopy.iosSafariStep1);
    expect(list.textContent).toContain("Add to Home Screen");
    expect(list.textContent).toContain("FoodBiz Manager");
    expect(screen.getByTestId("install-guide-ios-safari-share-icon")).toBeDefined();
  });

  it("shows browser address bar / toolbar Share steps with the Share glyph on other iOS browsers", () => {
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform="ios-other"
        copy={enCopy}
      />,
    );

    const list = screen.getByTestId("install-guide-ios-other");
    expect(list.tagName).toBe("OL");
    expect(list.textContent).toContain(enCopy.iosOtherStep1);
    expect(list.textContent).toContain("Add to Home Screen");
    expect(list.textContent).toContain("Les Saveurs du Continent");
    expect(screen.getByTestId("install-guide-ios-other-share-icon")).toBeDefined();
  });

  it("shows browser menu install steps on Android without a native prompt", () => {
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="FoodBiz Manager"
        platform="android-manual"
        copy={enCopy}
      />,
    );

    const list = screen.getByTestId("install-guide-android-manual");
    expect(list.tagName).toBe("OL");
    expect(list.textContent).toContain("(⋮ or ≡)");
    expect(list.textContent).toContain("Install app");
    expect(list.textContent).toContain("Add to Home screen");
    expect(list.textContent).toContain("FoodBiz Manager");
  });

  it("shows File -> Add to Dock steps on desktop macOS Safari", () => {
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="FoodBiz Manager"
        platform="macos-safari"
        copy={enCopy}
      />,
    );

    const list = screen.getByTestId("install-guide-macos-safari");
    expect(list.tagName).toBe("OL");
    expect(list.textContent).toContain("File");
    expect(list.textContent).toContain("Add to Dock");
    expect(list.textContent).toContain("FoodBiz Manager");
  });

  it("shows short generic guidance for other or unknown browsers and closes via the Done button", () => {
    const onOpenChange = vi.fn();
    render(
      <InstallGuide
        open
        onOpenChange={onOpenChange}
        appName="Les Saveurs du Continent"
        platform="generic"
        copy={enCopy}
      />,
    );

    expect(screen.getByTestId("install-guide-generic").textContent).toContain(
      "Les Saveurs du Continent",
    );
    fireEvent.click(screen.getByTestId("install-guide-done-button"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders localised French copy naming the app", () => {
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform="ios-safari"
        copy={frCopy}
        data-testid="fr-install-guide"
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Installer Les Saveurs du Continent" });
    expect(dialog.textContent).toContain("Sur l'écran d'accueil");
    expect(screen.getByTestId("fr-install-guide-done-button").textContent).toBe(frCopy.done);
  });

  it("freezes the platform while open so a late prompt or standalone flip does not swap the body", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <InstallGuide
        open={false}
        onOpenChange={onOpenChange}
        appName="FoodBiz Manager"
        platform="android-manual"
        copy={enCopy}
      />,
    );

    rerender(
      <InstallGuide
        open
        onOpenChange={onOpenChange}
        appName="FoodBiz Manager"
        platform="android-manual"
        copy={enCopy}
      />,
    );
    expect(screen.getByTestId("install-guide-android-manual")).toBeDefined();

    // Late beforeinstallprompt arrives while the dialog is still open: body stays frozen.
    rerender(
      <InstallGuide
        open
        onOpenChange={onOpenChange}
        appName="FoodBiz Manager"
        platform="native-prompt"
        copy={enCopy}
      />,
    );
    expect(screen.getByTestId("install-guide-android-manual")).toBeDefined();
    expect(screen.queryByTestId("install-guide-native-prompt")).toBeNull();

    // Standalone flip while still open: stays mounted until closed cleanly.
    rerender(
      <InstallGuide
        open
        onOpenChange={onOpenChange}
        appName="FoodBiz Manager"
        platform="standalone"
        copy={enCopy}
      />,
    );
    expect(screen.getByTestId("install-guide-android-manual")).toBeDefined();

    // Once closed and reopened with native-prompt, it picks up the new platform.
    rerender(
      <InstallGuide
        open={false}
        onOpenChange={onOpenChange}
        appName="FoodBiz Manager"
        platform="native-prompt"
        copy={enCopy}
      />,
    );
    rerender(
      <InstallGuide
        open
        onOpenChange={onOpenChange}
        appName="FoodBiz Manager"
        platform="native-prompt"
        copy={enCopy}
      />,
    );
    expect(screen.getByTestId("install-guide-native-prompt")).toBeDefined();
  });

  it("renders the iOS in-app browser guide naming the detected app and omits the Android Chrome intent link", () => {
    const onOpenChange = vi.fn();
    render(
      <InstallGuide
        open
        onOpenChange={onOpenChange}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "ios", app: "Instagram" }}
        copy={enCopy}
      />,
    );

    const body = screen.getByTestId("install-guide-in-app");
    expect(body.textContent).toContain(
      "This page is open inside Instagram. To install, open it in your browser.",
    );
    const steps = screen.getByTestId("install-guide-in-app-steps");
    expect(steps.tagName).toBe("OL");
    expect(steps.textContent).toContain("••• (More)");
    expect(steps.textContent).toContain("Open in Safari");
    expect(steps.textContent).toContain("Open in external browser");
    expect(screen.getByTestId("install-guide-in-app-share-icon")).toBeDefined();
    expect(screen.getByTestId("install-guide-copy-link-button")).toBeDefined();
    expect(screen.queryByTestId("install-guide-open-chrome-link")).toBeNull();

    fireEvent.click(screen.getByTestId("install-guide-done-button"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders the Android in-app guide with the real Chrome intent href + fallback URL after mount", () => {
    window.history.pushState({}, "", "/en/menu?cat=mains#featured");

    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "android", app: "Messenger" }}
        copy={enCopy}
      />,
    );

    const body = screen.getByTestId("install-guide-in-app");
    expect(body.textContent).toContain(
      "This page is open inside Messenger. To install, open it in your browser.",
    );
    const steps = screen.getByTestId("install-guide-in-app-steps");
    expect(steps.textContent).toContain("⋮ (three-dot)");
    expect(steps.textContent).toContain("Open in Chrome");
    expect(steps.textContent).toContain("Open in browser");
    expect(screen.queryByTestId("install-guide-in-app-share-icon")).toBeNull();

    const chromeLink = screen.getByTestId("install-guide-open-chrome-link");
    expect(chromeLink.tagName).toBe("A");
    const scheme = window.location.protocol === "http:" ? "http" : "https";
    const expectedFallback = encodeURIComponent(
      `${scheme}://${window.location.host}/en/menu?cat=mains`,
    );
    expect(chromeLink.getAttribute("href")).toBe(
      `intent://${window.location.host}/en/menu?cat=mains#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${expectedFallback};end`,
    );

    window.history.pushState({}, "", "/");
  });

  it("falls back to generic app wording when in-app browser name is unknown (EN and FR)", () => {
    const { rerender } = render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "other", app: null }}
        copy={enCopy}
      />,
    );

    expect(screen.getByTestId("install-guide-in-app-explanation").textContent).toContain(
      "This page is open inside this app.",
    );
    expect(screen.queryByTestId("install-guide-open-chrome-link")).toBeNull();

    rerender(
      <InstallGuide
        open={false}
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "ios", app: null }}
        copy={frCopy}
      />,
    );
    rerender(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "ios", app: null }}
        copy={frCopy}
      />,
    );

    expect(screen.getByTestId("install-guide-in-app-explanation").textContent).toContain(
      "Cette page est ouverte dans cette application.",
    );
    const frSteps = screen.getByTestId("install-guide-in-app-steps");
    expect(frSteps.textContent).toContain("••• (Plus)");
    expect(frSteps.textContent).toContain("Ouvrir dans Safari");
    expect(frSteps.textContent).toContain("Ouvrir dans le navigateur externe");
  });

  it("copies the current URL to the clipboard and announces localized confirmation", async () => {
    window.history.pushState({}, "", "/fr/menu");
    const writeText = vi.fn(async () => undefined);
    stubClipboard({ writeText });

    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "ios", app: "Instagram" }}
        copy={frCopy}
      />,
    );

    fireEvent.click(screen.getByTestId("install-guide-copy-link-button"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    const confirmation = await screen.findByTestId("install-guide-copy-confirmation");
    expect(confirmation.textContent).toContain(frCopy.inAppLinkCopied);

    window.history.pushState({}, "", "/");
  });

  it("shows a selectable URL fallback when clipboard API is unavailable or rejects", async () => {
    window.history.pushState({}, "", "/en/menu");
    stubClipboard(undefined);

    const { rerender } = render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "ios", app: "Facebook" }}
        copy={enCopy}
      />,
    );

    fireEvent.click(screen.getByTestId("install-guide-copy-link-button"));

    const fallback = await screen.findByTestId("install-guide-copy-fallback");
    expect(fallback.textContent).toContain(enCopy.inAppCopyFallback);
    const input = screen.getByTestId("install-guide-copy-fallback-input") as HTMLInputElement;
    expect(input.value).toBe(window.location.href);
    expect(input.readOnly).toBe(true);
    const selectSpy = vi.spyOn(input, "select");
    fireEvent.focus(input);
    expect(selectSpy).toHaveBeenCalledTimes(1);

    // Close and reopen: resets previous copy state and tests clipboard rejection path too.
    const rejectWrite = vi.fn(async () => {
      throw new Error("Permission denied");
    });
    stubClipboard({ writeText: rejectWrite });

    rerender(
      <InstallGuide
        open={false}
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "android", app: "Instagram" }}
        copy={enCopy}
      />,
    );
    rerender(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="Les Saveurs du Continent"
        platform={{ kind: "in-app", os: "android", app: "Instagram" }}
        copy={enCopy}
      />,
    );
    expect(screen.queryByTestId("install-guide-copy-fallback")).toBeNull();

    fireEvent.click(screen.getByTestId("install-guide-copy-link-button"));
    await waitFor(() => expect(rejectWrite).toHaveBeenCalledWith(window.location.href));
    expect(await screen.findByTestId("install-guide-copy-fallback")).toBeDefined();

    window.history.pushState({}, "", "/");
  });

  it.each<{ label: string; platform: InstallGuidePlatform }>([
    { label: "native-prompt", platform: "native-prompt" },
    { label: "ios-safari", platform: "ios-safari" },
    { label: "ios-other", platform: "ios-other" },
    { label: "android-manual", platform: "android-manual" },
    { label: "macos-safari", platform: "macos-safari" },
    { label: "generic", platform: "generic" },
    { label: "in-app-ios", platform: { kind: "in-app", os: "ios", app: "Instagram" } },
    { label: "in-app-android", platform: { kind: "in-app", os: "android", app: "TikTok" } },
    { label: "in-app-generic", platform: { kind: "in-app", os: "other", app: null } },
  ])("has no WCAG 2.2 AA axe violations for the $label variant", async ({ platform }) => {
    render(
      <InstallGuide
        open
        onOpenChange={vi.fn()}
        appName="FoodBiz Manager"
        platform={platform}
        copy={enCopy}
        onInstall={vi.fn()}
      />,
    );

    const results = await axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
