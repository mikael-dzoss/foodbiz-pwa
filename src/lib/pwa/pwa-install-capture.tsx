"use client";

import { useEffect } from "react";
import { startPwaInstallCapture } from "./install-store";

// Attach the listeners when this client module is evaluated, before hydration: Chromium can fire
// `beforeinstallprompt` before effects run. The effect is an idempotent fallback.
if (typeof window !== "undefined") startPwaInstallCapture();

/** Always-mounted (root layout) so `beforeinstallprompt` is captured before any UI asks for it. */
export function PwaInstallCapture() {
  useEffect(() => {
    startPwaInstallCapture();
  }, []);
  return null;
}
