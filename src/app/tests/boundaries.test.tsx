import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GlobalError from "../global-error";
import ManageError from "../manage/(authenticated)/error";

describe.each([
  ["global error", GlobalError, "global-error-retry", "global-error-ref"],
  ["manager error", ManageError, "error-state-retry", "manage-error-ref"],
])("%s boundary", (_name, Boundary, retryTestId, refTestId) => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls retry, shows only the digest and never the raw message", () => {
    const retry = vi.fn();
    const error = Object.assign(new Error("secret db password leaked"), { digest: "abc123" });
    render(<Boundary error={error} retry={retry} />);

    expect(document.body.textContent).not.toContain("secret db password leaked");
    expect(screen.getByTestId(refTestId).textContent).toContain("abc123");
    fireEvent.click(screen.getByTestId(retryTestId));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("manager error boundary navigation", () => {
  it("offers a way back to the dashboard", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ManageError error={new Error("x")} retry={vi.fn()} />);
    expect(screen.getByTestId("manage-error-dashboard").getAttribute("href")).toBe("/manage");
  });
});
