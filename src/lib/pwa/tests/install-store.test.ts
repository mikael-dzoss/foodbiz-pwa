import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPwaInstallState,
  promptPwaInstall,
  resetPwaInstallStore,
  startPwaInstallCapture,
  subscribePwaInstall,
} from "../install-store";

function installEvent(outcome: "accepted" | "dismissed") {
  const prompt = vi.fn(async () => {});
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  return { event, prompt };
}

afterEach(() => resetPwaInstallStore());

describe("pwa install store", () => {
  it("captures beforeinstallprompt without any subscriber and prevents the default mini-infobar", () => {
    startPwaInstallCapture();
    const { event } = installEvent("accepted");
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(getPwaInstallState().deferredPrompt).toBe(event);
  });

  it("notifies subscribers and prompts once", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePwaInstall(listener);
    const { event, prompt } = installEvent("dismissed");
    window.dispatchEvent(event);
    expect(listener).toHaveBeenCalled();

    expect(await promptPwaInstall()).toBe("dismissed");
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(getPwaInstallState().deferredPrompt).toBeNull();
    expect(getPwaInstallState().installed).toBe(false);
    expect(await promptPwaInstall()).toBe("unavailable");
    unsubscribe();
  });

  it("marks installed after an accepted prompt", async () => {
    startPwaInstallCapture();
    window.dispatchEvent(installEvent("accepted").event);
    expect(await promptPwaInstall()).toBe("accepted");
    expect(getPwaInstallState().installed).toBe(true);
  });

  it("clears the prompt and flags installed on appinstalled", () => {
    startPwaInstallCapture();
    window.dispatchEvent(installEvent("accepted").event);
    window.dispatchEvent(new Event("appinstalled"));
    expect(getPwaInstallState()).toEqual({ deferredPrompt: null, installed: true });
  });
});
