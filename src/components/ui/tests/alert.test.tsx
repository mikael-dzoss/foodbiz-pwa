import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import React from "react";
import { describe, expect, it } from "vitest";
import { Alert } from "../index";

describe("Alert", () => {
  it("uses role='alert' by default for error tone and error surface tokens", () => {
    render(
      <Alert tone="error" data-testid="alert-error">
        Something went wrong
      </Alert>,
    );

    const el = screen.getByRole("alert");
    expect(el.getAttribute("data-testid")).toBe("alert-error");
    expect(el.textContent).toContain("Something went wrong");
    expect(el.className).toContain("border-destructive/30");
    expect(el.className).toContain("bg-destructive/10");
    expect(el.className).toContain("text-destructive");
    expect(el.className).toContain("rounded-xl");
    expect(el.className).toContain("text-body-sm");
  });

  it("uses role='status' by default for warning and info tones with matching tokens", () => {
    render(
      <>
        <Alert tone="warning" data-testid="alert-warning">
          Kitchen closed
        </Alert>
        <Alert tone="info" data-testid="alert-info">
          Changes saved
        </Alert>
      </>,
    );

    const warning = screen.getByTestId("alert-warning");
    expect(warning.getAttribute("role")).toBe("status");
    expect(warning.className).toContain("bg-warning-soft");
    expect(warning.className).toContain("text-warning-soft-foreground");
    expect(warning.className).toContain("border-warning/30");

    const info = screen.getByTestId("alert-info");
    expect(info.getAttribute("role")).toBe("status");
    expect(info.className).toContain("bg-primary-soft");
    expect(info.className).toContain("text-primary-soft-foreground");
    expect(info.className).toContain("border-primary/30");
  });

  it("supports role override for state-dependent announcements", () => {
    render(
      <>
        <Alert tone="error" role="status" data-testid="error-as-status">
          No pickup points configured
        </Alert>
        <Alert tone="warning" role="alert" data-testid="warning-as-alert">
          Urgent warning
        </Alert>
      </>,
    );

    expect(screen.getByTestId("error-as-status").getAttribute("role")).toBe("status");
    expect(screen.getByTestId("warning-as-alert").getAttribute("role")).toBe("alert");
  });

  it("forwards ref and tabIndex so callers can programmatically focus the notice", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Alert tone="error" ref={ref} tabIndex={-1} data-testid="focusable-alert">
        Focus me on submit error
      </Alert>,
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.getAttribute("tabindex")).toBe("-1");
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });

  it("passes through id, data-testid, className and aria-* attributes", () => {
    render(
      <Alert
        tone="info"
        id="custom-alert-id"
        data-testid="custom-alert"
        className="mt-4"
        aria-live="polite"
        aria-label="Order note"
      >
        Body text
      </Alert>,
    );

    const el = screen.getByTestId("custom-alert");
    expect(el.id).toBe("custom-alert-id");
    expect(el.className).toContain("mt-4");
    expect(el.getAttribute("aria-live")).toBe("polite");
    expect(el.getAttribute("aria-label")).toBe("Order note");
  });

  it("renders optional title using the small-heading title role and hides default icon from AT", () => {
    render(
      <Alert tone="error" title="Order cancelled" data-testid="titled-alert">
        <p>Your refund will be processed.</p>
      </Alert>,
    );

    const el = screen.getByTestId("titled-alert");
    const title = screen.getByText("Order cancelled");
    expect(title.className).toContain("text-label-md");
    expect(el.textContent).toContain("Your refund will be processed.");

    const iconWrapper = el.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper?.querySelector("svg")).not.toBeNull();
  });

  it("renders a custom icon override inside the aria-hidden icon slot", () => {
    render(
      <Alert
        tone="warning"
        icon={<Clock data-testid="custom-clock-icon" className="h-4 w-4" />}
        data-testid="custom-icon-alert"
      >
        Opens tomorrow at 11:00
      </Alert>,
    );

    const icon = screen.getByTestId("custom-clock-icon");
    expect(icon.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
