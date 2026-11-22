"use client";

import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-storage-key";

export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  mounted: boolean;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(THEME_STORAGE_KEY);
    if (val === "light" || val === "dark" || val === "system") {
      return val;
    }
  } catch {
    // ignore
  }
  return null;
}

const themeListeners = new Set<() => void>();

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) callback();
  };

  const mediaQuery =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const handleMedia = () => callback();

  window.addEventListener("storage", handleStorage);
  mediaQuery?.addEventListener("change", handleMedia);

  return () => {
    themeListeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
    mediaQuery?.removeEventListener("change", handleMedia);
  };
}

const emptySubscribe = () => () => {};

/**
 * Only the configured default lives in context, and it never changes after the first render.
 * The theme itself is read from the external store inside `useTheme()` (in the consuming
 * component), so the post-hydration switch from the server snapshot to the stored value never
 * changes a context value above a Suspense boundary. A context change there would force React to
 * client-render any boundary that is still streaming and leave its server HTML orphaned.
 */
const ThemeDefaultContext = createContext<Theme | undefined>(undefined);

function setTheme(nextTheme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // ignore
  }
  themeListeners.forEach((listener) => listener());
}

function useThemeState(defaultTheme: Theme): ThemeContextValue {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const storedTheme = useSyncExternalStore(subscribeTheme, getStoredTheme, () => defaultTheme);
  const theme: Theme = storedTheme ?? defaultTheme;
  const resolvedTheme: ResolvedTheme =
    mounted && theme === "system" ? getSystemTheme() : theme === "system" ? "light" : theme;
  return { theme, resolvedTheme, setTheme, mounted };
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const { resolvedTheme, mounted } = useThemeState(defaultTheme);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme, mounted]);

  return <ThemeDefaultContext value={defaultTheme}>{children}</ThemeDefaultContext>;
}

export function useTheme(): ThemeContextValue {
  const defaultTheme = useContext(ThemeDefaultContext);
  if (!defaultTheme) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return useThemeState(defaultTheme);
}
