import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginView } from "../login-view";
import { LoginErrorBanner, LoginNextInput } from "../login-error-banner";
import { getDictionary } from "@/domain/i18n";

describe("LoginErrorBanner", () => {
  it("renders nothing when error is not provided", () => {
    const { container } = render(<LoginErrorBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders translated error alert for known error code", () => {
    render(<LoginErrorBanner error="denied" locale="en" />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain(getDictionary("en").auth.errors.denied);
    expect(screen.queryByTestId("login-error-signout-btn")).toBeNull();
  });

  it("renders sign-out form when error is no_access", () => {
    render(<LoginErrorBanner error="no_access" locale="fr" />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(getDictionary("fr").auth.errors.no_access);
    const signoutBtn = screen.getByTestId("login-error-signout-btn");
    expect(signoutBtn).toBeDefined();
    expect(signoutBtn.textContent).toBe("Se déconnecter");
  });
});

describe("LoginNextInput", () => {
  it("renders nothing when next is null or omitted", () => {
    const { container } = render(<LoginNextInput />);
    expect(container.firstChild).toBeNull();
  });

  it("renders hidden input with next value", () => {
    const { container } = render(<LoginNextInput next="/manage/orders" />);
    const input = container.querySelector('input[name="next"]') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.type).toBe("hidden");
    expect(input.value).toBe("/manage/orders");
  });
});

describe("LoginView", () => {
  it("renders Stitch mobile container and branding", () => {
    render(<LoginView showDemoAccount={false} />);

    expect(screen.getByRole("heading", { name: /manager sign-in/i, level: 1 })).toBeDefined();
    expect(screen.getByText("Manager Portal")).toBeDefined();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeDefined();
    expect(screen.getByText("System Online")).toBeDefined();
    expect(screen.getByText("Latency: 24ms")).toBeDefined();
  });

  it("renders demo button only when showDemoAccount is true", () => {
    const { rerender } = render(<LoginView showDemoAccount={false} />);
    expect(screen.queryByRole("button", { name: /sign in as manager/i })).toBeNull();

    rerender(<LoginView showDemoAccount={true} />);
    expect(screen.getByRole("button", { name: /sign in as manager/i })).toBeDefined();
  });
});
