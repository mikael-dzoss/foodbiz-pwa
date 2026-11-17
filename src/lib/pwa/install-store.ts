"use client";

/**
 * Module-level store for the deferred `beforeinstallprompt` event.
 *
 * Chromium fires the event once, early, and only the first listener to `preventDefault()` keeps it.
 * A listener that mounts later (e.g. inside a closed drawer) would miss it, so `PwaInstallCapture`
 * (mounted in the root layout) starts listening at app boot and every consumer just reads this
 * store through `useSyncExternalStore`. A context would change value after hydration above
 * Suspense boundaries; see `components/theme/theme-provider.tsx`.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaInstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
}

const INITIAL_STATE: PwaInstallState = { deferredPrompt: null, installed: false };

let state: PwaInstallState = INITIAL_STATE;
let listening = false;
const listeners = new Set<() => void>();

function setState(next: PwaInstallState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  setState({ ...state, deferredPrompt: event as BeforeInstallPromptEvent });
}

function onAppInstalled() {
  setState({ deferredPrompt: null, installed: true });
}

/** Idempotent: attaches the window listeners once per page load. */
export function startPwaInstallCapture() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
}

export function subscribePwaInstall(callback: () => void) {
  startPwaInstallCapture();
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getPwaInstallState(): PwaInstallState {
  return state;
}

export function getServerPwaInstallState(): PwaInstallState {
  return INITIAL_STATE;
}

/** Shows the native prompt once; the browser allows each deferred event a single use. */
export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const { deferredPrompt } = state;
  if (!deferredPrompt) return "unavailable";
  setState({ ...state, deferredPrompt: null });
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") setState({ deferredPrompt: null, installed: true });
  return outcome;
}

/** Test helper: forget the captured event and installed flag. */
export function resetPwaInstallStore() {
  state = INITIAL_STATE;
  listeners.forEach((listener) => listener());
}

// Register as early as this module is evaluated (root-layout bundle), before any drawer mounts.
startPwaInstallCapture();
