import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { subscribeFeatureInterest } from "@/domain/features";
import { SoonBadge, SoonItem, EmptyState, ErrorState } from "../index";

describe("Feedback Components & States (#33, #34)", () => {
  describe("SoonBadge", () => {
    it("renders default label and custom label", () => {
      render(
        <>
          <SoonBadge data-testid="b-def" />
          <SoonBadge data-testid="b-custom" label="Bientôt" />
        </>,
      );
      expect(screen.getByTestId("b-def").textContent).toBe("Soon");
      expect(screen.getByTestId("b-custom").textContent).toBe("Bientôt");
    });
  });

  describe("SoonItem", () => {
    it("renders item, remains focusable, emits event, and shows toast on click", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeFeatureInterest(listener);

      render(
        <ToastProvider>
          <SoonItem data-testid="soon-row" featureKey="orders.export" />
        </ToastProvider>,
      );

      const item = screen.getByTestId("soon-row");
      expect(item.getAttribute("aria-label")).toContain("coming soon");

      fireEvent.click(item);
      expect(listener).toHaveBeenCalledWith(
        "orders.export",
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );
      expect(screen.getByText("Coming soon — we noted your interest")).toBeDefined();

      unsubscribe();
    });

    it("triggers on keyboard Enter", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeFeatureInterest(listener);

      render(
        <ToastProvider>
          <SoonItem data-testid="soon-row" featureKey="settings.notifications" />
        </ToastProvider>,
      );

      const item = screen.getByTestId("soon-row");
      fireEvent.keyDown(item, { key: "Enter" });
      expect(listener).toHaveBeenCalledWith(
        "settings.notifications",
        expect.objectContaining({ timestamp: expect.any(Number) }),
      );

      unsubscribe();
    });
  });

  describe("EmptyState", () => {
    it("renders title, description, and triggers action", () => {
      const handleAction = vi.fn();
      render(
        <EmptyState
          data-testid="empty"
          title="No orders yet"
          description="New orders will appear here once guests place them."
          action={{ label: "Create manual order", onClick: handleAction }}
        />,
      );

      expect(screen.getByText("No orders yet")).toBeDefined();
      expect(screen.getByText("New orders will appear here once guests place them.")).toBeDefined();

      const btn = screen.getByTestId("empty-state-action");
      fireEvent.click(btn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });

  describe("ErrorState", () => {
    it("renders error message and triggers retry", () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          data-testid="error"
          title="Something went wrong"
          message="Failed to load orders."
          onRetry={handleRetry}
          retryLabel="Try again"
        />,
      );

      expect(screen.getByText("Something went wrong")).toBeDefined();
      expect(screen.getByText("Failed to load orders.")).toBeDefined();

      const retryBtn = screen.getByTestId("error-state-retry");
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalledTimes(1);
    });
  });
});
