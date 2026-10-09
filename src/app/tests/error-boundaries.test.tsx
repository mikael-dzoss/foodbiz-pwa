import { render, screen, act } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "../error";
import NotFound from "../not-found";

describe("src/app ErrorPage", () => {
  it("renders error message and triggers reset on retry click", () => {
    const reset = vi.fn();
    const testError = new Error("Failed to load storefront data");

    render(<ErrorPage error={testError} reset={reset} />);

    expect(screen.getByText("Application error")).toBeDefined();
    expect(screen.getByText("Failed to load storefront data")).toBeDefined();

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    act(() => {
      retryBtn.click();
    });

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders fallback message when error message is empty", () => {
    const reset = vi.fn();
    const testError = new Error("");

    render(<ErrorPage error={testError} reset={reset} />);

    expect(
      screen.getByText("An unexpected error occurred while processing your request."),
    ).toBeDefined();
  });
});

describe("src/app NotFound", () => {
  it("renders empty state and link to home page", () => {
    render(<NotFound />);

    expect(screen.getByText("Page not found")).toBeDefined();
    expect(
      screen.getByText("The page you are looking for doesn't exist or has been moved."),
    ).toBeDefined();

    const homeLink = screen.getByRole("link", { name: "Back to home" });
    expect(homeLink).toBeDefined();
    expect(homeLink.getAttribute("href")).toBe("/");
  });
});
