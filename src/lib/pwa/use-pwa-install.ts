"use client";

import { useSyncExternalStore } from "react";
import {
  getPwaInstallState,
  getServerPwaInstallState,
  promptPwaInstall,
  subscribePwaInstall,
} from "./install-store";

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

function getIosSnapshot(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const noopSubscribe = () => () => {};

export type PwaInstallOutcome = "accepted" | "dismissed" | "unavailable";

/** Shared PWA install state: native prompt (Chromium), iOS detection and standalone mode. */
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
  const isIos = useSyncExternalStore(noopSubscribe, getIosSnapshot, () => false);

  return {
    isStandalone: isRunningStandalone || installed,
    canPrompt: deferredPrompt !== null,
    isIos,
    promptInstall: promptPwaInstall,
  };
}
