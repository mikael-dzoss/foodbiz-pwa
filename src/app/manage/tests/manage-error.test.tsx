import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ManageError from "../(authenticated)/error";

describe("manager error boundary", () => {
  it("shows generic localized copy, a reference code, and calls retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    const error = Object.assign(new Error("password=hunter2 relation does not exist"), {
      digest: "abc123",
    });
    render(<ManageError error={error} retry={retry} />);

    expect(screen.getByTestId("manage-error")).toBeDefined();
    expect(screen.getByText("We could not load this page")).toBeDefined();
    expect(screen.queryByText(/hunter2/)).toBeNull();
    expect(screen.getByTestId("manage-error-ref").textContent).toBe("Reference: abc123");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("omits the reference when there is no digest", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ManageError error="boom" retry={vi.fn()} />);
    expect(screen.queryByTestId("manage-error-ref")).toBeNull();
  });
});
