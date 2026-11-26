"use client";

import { useSyncExternalStore } from "react";
import {
  getPwaInstallState,
  getServerPwaInstallState,
  promptPwaInstall,
  subscribePwaInstall,
} from "./install-store";
import { detectInstallPlatform, isIosUserAgent, type InstallPlatform } from "./platform";

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

type ManualInstallPlatform = Exclude<InstallPlatform, "standalone" | "native-prompt">;

function getManualPlatformSnapshot(): ManualInstallPlatform {
  if (typeof navigator === "undefined") return "generic";
  return detectInstallPlatform({
    userAgent: navigator.userAgent ?? "",
    platform: navigator.platform ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    canPrompt: false,
    isStandalone: false,
  }) as ManualInstallPlatform;
}

function getIosSnapshot(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosUserAgent({
    userAgent: navigator.userAgent ?? "",
    platform: navigator.platform ?? "",
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

const noopSubscribe = () => () => {};

export type PwaInstallOutcome = "accepted" | "dismissed" | "unavailable";

/** Shared PWA install state: native prompt (Chromium), platform detection and standalone mode. */
export function usePwaInstall() {
  const { deferredPrompt, installed } = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallState,
    getServerPwaInstallState,
  );
  const isRunningStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    () => false,
  );
  const manualPlatform = useSyncExternalStore(
    noopSubscribe,
    getManualPlatformSnapshot,
    () => "generic" as const,
  );
  const isIos = useSyncExternalStore(noopSubscribe, getIosSnapshot, () => false);

  const isStandalone = isRunningStandalone || installed;
  const canPrompt = deferredPrompt !== null;
  const platform: InstallPlatform = isStandalone
    ? "standalone"
    : canPrompt
      ? "native-prompt"
      : manualPlatform;

  return {
    isStandalone,
    canPrompt,
    isIos,
    platform,
    promptInstall: promptPwaInstall,
  };
}
