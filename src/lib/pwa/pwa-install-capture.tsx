"use client";

import { useEffect } from "react";
import { startPwaInstallCapture } from "./install-store";

/** Always-mounted (root layout) so `beforeinstallprompt` is captured before any UI asks for it. */
export function PwaInstallCapture() {
  useEffect(() => {
    startPwaInstallCapture();
  }, []);
  return null;
}
