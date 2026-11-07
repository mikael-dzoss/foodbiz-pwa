import { act, cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enDictionary } from "@/domain/i18n";
import { ToastProvider } from "@/components/ui";
import { InstallAppCard } from "../components/install-app-card";

const dict = enDictionary.storefront;

function setEnvironment({ standalone = false, ios = false } = {}) {
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
    userAgent: ios
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"
      : "Mozilla/5.0 (X11; Linux)",
    platform: ios ? "iPhone" : "Linux x86_64",
    maxTouchPoints: ios ? 5 : 0,
  });
}

function renderCard() {
  return render(
    <ToastProvider>
      <InstallAppCard dict={dict} />
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
  cleanup();
  vi.unstubAllGlobals();
});

describe("InstallAppCard (#232)", () => {
  it("stays hidden when the browser cannot install and it is not iOS", () => {
    setEnvironment();
    renderCard();
    expect(screen.queryByTestId("install-app-card")).toBeNull();
  });

  it("stays hidden when already running as an installed app", () => {
    setEnvironment({ standalone: true, ios: true });
    renderCard();
    expect(screen.queryByTestId("install-app-card")).toBeNull();
  });

  it("uses the native prompt and hides itself once accepted", async () => {
    setEnvironment();
    renderCard();
    const event = firePrompt("accepted");
    expect(event.defaultPrevented).toBe(true);

    fireEvent.click(await screen.findByTestId("install-app-button"));
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
    expect(await screen.findByText(dict.installAppDone)).toBeDefined();
    await waitFor(() => expect(screen.queryByTestId("install-app-card")).toBeNull());
  });

  it("hides the card after a dismissed prompt since browsers allow one prompt per page", async () => {
    setEnvironment();
    renderCard();
    const event = firePrompt("dismissed");
    fireEvent.click(await screen.findByTestId("install-app-button"));
    await waitFor(() => expect(event.prompt).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("install-app-button")).toBeNull());
  });

  it("shows Add to Home Screen steps on iOS", async () => {
    setEnvironment({ ios: true });
    renderCard();
    fireEvent.click(screen.getByTestId("install-app-button"));
    const dialog = await screen.findByRole("dialog", { name: dict.installIosTitle });
    expect(dialog.textContent).toContain(dict.installIosStep2);
  });
});
