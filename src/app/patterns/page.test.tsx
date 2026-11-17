import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "@/components/theme";
import { ToastProvider } from "@/components/ui";
import PatternsPage from "./page";

describe("P-01 Patterns Component Inventory Screen", () => {
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

  it("showcases Field, SegmentedControl, ConfirmDialog, ActionBar and the error toast", () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <PatternsPage />
        </ToastProvider>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("section-field")).toBeDefined();
    expect(screen.getByTestId("section-segmented")).toBeDefined();
    expect(screen.getByTestId("section-action-bar")).toBeDefined();
    expect(screen.getByTestId("pattern-action-bar")).toBeDefined();

    fireEvent.click(screen.getByTestId("pattern-segment-delivery"));
    expect(screen.getByTestId("pattern-segment-delivery").getAttribute("aria-checked")).toBe(
      "true",
    );

    fireEvent.click(screen.getByTestId("trigger-confirm-dialog"));
    expect(screen.getByTestId("pattern-confirm-dialog")).toBeDefined();

    fireEvent.click(screen.getByTestId("trigger-error-toast"));
    expect(screen.getByTestId("toast-error")).toBeDefined();
  });
});
