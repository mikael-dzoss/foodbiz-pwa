import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enDictionary, frDictionary } from "@/domain/i18n";
import type { InstallGuidePlatform } from "@/lib/pwa/platform";
import { InstallGuide } from "../install-guide";

const enCopy = enDictionary.installGuide;
const frCopy = frDictionary.installGuide;

afterEach(() => {
  document.documentElement.classList.remove("dark");
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
    expect(screen.getByTestId("install-guide-share-icon")).toBeDefined();
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
    expect(screen.getByTestId("install-guide-share-icon")).toBeDefined();
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
    expect(list.textContent).toContain(enCopy.androidStep1);
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

  it.each<InstallGuidePlatform>([
    "native-prompt",
    "ios-safari",
    "ios-other",
    "android-manual",
    "macos-safari",
    "generic",
  ])("has no WCAG 2.2 AA axe violations for the %s variant", async (platform) => {
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
