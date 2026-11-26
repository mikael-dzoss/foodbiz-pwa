import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { resetPwaInstallStore } from "@/lib/pwa/install-store";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enDictionary, frDictionary, type SupportedLocale } from "@/domain/i18n";
import { ToastProvider } from "@/components/ui";
import { InstallAppCard } from "../components/install-app-card";

const SHOP_NAME = "Les Saveurs du Continent";

const UA = {
  iosSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iosChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0",
  macosSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  linuxChrome:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

function setEnvironment({
  standalone = false,
  userAgent = UA.linuxChrome,
  platform = "Linux x86_64",
  maxTouchPoints = 0,
} = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: standalone && query.includes("standalone"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent,
    platform,
    maxTouchPoints,
  });
}

function renderCard(locale: SupportedLocale = "en") {
  const dict = locale === "fr" ? frDictionary.storefront : enDictionary.storefront;
  return render(
    <ToastProvider>
      <InstallAppCard dict={dict} businessName={SHOP_NAME} locale={locale} />
    </ToastProvider>,
  );
}

function firePrompt(outcome: "accepted" | "dismissed") {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

afterEach(() => {
  resetPwaInstallStore();
  vi.unstubAllGlobals();
});

describe("InstallAppCard (#100, #232)", () => {
  it("stays hidden when already running as an installed standalone app", () => {
    setEnvironment({ standalone: true, userAgent: UA.iosSafari, platform: "iPhone" });
    renderCard();
    expect(screen.queryByTestId("install-app-card")).toBeNull();
  });

  it("opens the shared install guide with the native Install button and hides after accept", async () => {
    setEnvironment();
    renderCard();
    const event = firePrompt("accepted");
    expect(event.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByTestId("install-app-button"));
    const dialog = await screen.findByRole("dialog", { name: `Install ${SHOP_NAME}` });
    expect(dialog).toBe(screen.getByTestId("storefront-install-guide"));

    fireEvent.click(screen.getByTestId("storefront-install-guide-install-button"));
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
    expect(await screen.findByText(enDictionary.storefront.installAppDone)).toBeDefined();
    await waitFor(() => expect(screen.queryByTestId("install-app-card")).toBeNull());
  });

  it("closes the guide after a dismissed native prompt and falls back to manual guidance on reopen", async () => {
    setEnvironment({ userAgent: UA.androidFirefox });
    renderCard();
    const event = firePrompt("dismissed");

    fireEvent.click(screen.getByTestId("install-app-button"));
    fireEvent.click(await screen.findByTestId("storefront-install-guide-install-button"));
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("storefront-install-guide")).toBeNull());

    fireEvent.click(screen.getByTestId("install-app-button"));
    expect(await screen.findByTestId("storefront-install-guide-android-manual")).toBeDefined();
  });

  it("opens the shared guide with Safari Share steps and icon on iOS Safari", async () => {
    setEnvironment({ userAgent: UA.iosSafari, platform: "iPhone", maxTouchPoints: 5 });
    renderCard();
    fireEvent.click(screen.getByTestId("install-app-button"));
    const dialog = await screen.findByRole("dialog", { name: `Install ${SHOP_NAME}` });
    expect(dialog.textContent).toContain("Add to Home Screen");
    expect(screen.getByTestId("storefront-install-guide-ios-safari")).toBeDefined();
    expect(screen.getByTestId("storefront-install-guide-ios-safari-share-icon")).toBeDefined();
  });

  it("opens the shared guide with non-Safari Share steps on iOS Chrome", async () => {
    setEnvironment({ userAgent: UA.iosChrome, platform: "iPhone", maxTouchPoints: 5 });
    renderCard();
    fireEvent.click(screen.getByTestId("install-app-button"));
    expect(await screen.findByTestId("storefront-install-guide-ios-other")).toBeDefined();
  });

  it("opens the shared guide with French copy and the shop name on the FR storefront", async () => {
    setEnvironment({ userAgent: UA.macosSafari, platform: "MacIntel", maxTouchPoints: 0 });
    renderCard("fr");
    fireEvent.click(screen.getByTestId("install-app-button"));
    const dialog = await screen.findByRole("dialog", { name: `Installer ${SHOP_NAME}` });
    expect(dialog.textContent).toContain("Ajouter au Dock");
    expect(screen.getByTestId("storefront-install-guide-macos-safari")).toBeDefined();
  });

  it("shows short generic guidance on desktop browsers without a native prompt", async () => {
    setEnvironment({ userAgent: UA.linuxChrome });
    renderCard();
    fireEvent.click(screen.getByTestId("install-app-button"));
    const generic = await screen.findByTestId("storefront-install-guide-generic");
    expect(generic.textContent).toContain(SHOP_NAME);
  });
});
