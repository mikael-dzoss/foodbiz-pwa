import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "../global-not-found";

// The real document renders <html>/<body> and loads next/font, which do not belong in a unit test.
vi.mock("@/components/root-document", () => ({
  RootDocument: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("global not-found", () => {
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
