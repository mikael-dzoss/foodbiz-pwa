import { render, screen, act } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "../error";
import NotFound from "../not-found";

describe("src/app ErrorPage", () => {
  it("shows generic copy, never the raw error message, and triggers retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();

    render(<ErrorPage error={new Error("Failed to load storefront data")} retry={retry} />);

    expect(screen.getByText("We could not load this page")).toBeDefined();
    expect(screen.queryByText("Failed to load storefront data")).toBeNull();

    act(() => {
      screen.getByRole("button", { name: "Try again" }).click();
    });
    expect(retry).toHaveBeenCalledTimes(1);
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
