import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { describe, expect, it, afterEach } from "vitest";
import { ThemeProvider } from "@/components/theme";
import { ToastProvider } from "@/components/ui";
import PatternsPage from "./page";

describe("P-01 Patterns Component Inventory Screen", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all 12 pattern reference sections from Stitch spec", () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <PatternsPage />
        </ToastProvider>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme-light-btn")).toBeDefined();
    expect(screen.getByTestId("theme-dark-btn")).toBeDefined();
    expect(screen.getByTestId("theme-system-btn")).toBeDefined();

    expect(screen.getByTestId("section-buttons")).toBeDefined();
    expect(screen.getByTestId("section-forms")).toBeDefined();
    expect(screen.getByTestId("section-badges")).toBeDefined();
    expect(screen.getByTestId("section-kpis")).toBeDefined();
    expect(screen.getByTestId("section-lists")).toBeDefined();
    expect(screen.getByTestId("section-tabs")).toBeDefined();
    expect(screen.getByTestId("section-stepper")).toBeDefined();
    expect(screen.getByTestId("section-empty")).toBeDefined();
    expect(screen.getByTestId("section-error")).toBeDefined();
    expect(screen.getByTestId("section-skeleton")).toBeDefined();
    expect(screen.getByTestId("section-toast")).toBeDefined();
    expect(screen.getByTestId("section-overlays")).toBeDefined();
  });
});
