import { render, screen, act, cleanup } from "@testing-library/react";
import React from "react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from "../theme-provider";
import { ThemeScript } from "../theme-script";

function TestConsumer() {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <span data-testid="mounted">{mounted ? "yes" : "no"}</span>
      <button data-testid="set-dark" onClick={() => setTheme("dark")}>
        Dark
      </button>
      <button data-testid="set-light" onClick={() => setTheme("light")}>
        Light
      </button>
      <button data-testid="set-system" onClick={() => setTheme("system")}>
        System
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("provides default theme and mounts correctly", () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(screen.getByTestId("mounted").textContent).toBe("yes");
  });

  it("updates theme to dark and sets dark class on root document", () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestConsumer />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByTestId("set-dark").click();
    });

    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("updates theme to light and removes dark class from root document", () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByTestId("set-light").click();
    });

    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("throws error when useTheme is called outside of ThemeProvider", () => {
    expect(() => render(<TestConsumer />)).toThrow("useTheme must be used within a ThemeProvider");
  });

  it("renders ThemeScript inline script tag", () => {
    const { container } = render(<ThemeScript />);
    const script = container.querySelector("script");
    expect(script).not.toBeNull();
    expect(script?.innerHTML).toContain("foodbiz-theme");
  });
});
