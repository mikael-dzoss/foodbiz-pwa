import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ManagerLoginPage from "../login/page";
import { getDictionary } from "@/domain/i18n";

describe("ManagerLoginPage", () => {
  it("renders manager sign-in heading, demo button, and active Google sign-in button", () => {
    render(<ManagerLoginPage />);

    const heading = screen.getByRole("heading", {
      name: /manager sign-in/i,
      level: 1,
    });
    expect(heading).toBeDefined();

    const submitBtn = screen.getByRole("button", {
      name: /sign in as manager/i,
    });
    expect(submitBtn).toBeDefined();
    expect(submitBtn.getAttribute("id")).toBe("sign-in-submit-btn");

    const googleBtn = screen.getByRole("button", {
      name: /continue with google/i,
    });
    expect(googleBtn).toBeDefined();
    expect(googleBtn.getAttribute("id")).toBe("google-sign-in-btn");
    expect(googleBtn.hasAttribute("disabled")).toBe(false);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("translated error states", () => {
    const errorCases = [
      {
        code: "cancelled",
        en: getDictionary("en").auth.errors.cancelled,
        fr: getDictionary("fr").auth.errors.cancelled,
      },
      {
        code: "denied",
        en: getDictionary("en").auth.errors.denied,
        fr: getDictionary("fr").auth.errors.denied,
      },
      {
        code: "no_access",
        en: getDictionary("en").auth.errors.no_access,
        fr: getDictionary("fr").auth.errors.no_access,
      },
      {
        code: "auth_failed",
        en: getDictionary("en").auth.errors.auth_failed,
        fr: getDictionary("fr").auth.errors.auth_failed,
      },
    ] as const;

    errorCases.forEach(({ code, en, fr }) => {
      it(`renders translated error message for "${code}" in English`, () => {
        render(<ManagerLoginPage error={code} locale="en" />);

        const alert = screen.getByRole("alert");
        expect(alert).toBeDefined();
        expect(alert.getAttribute("data-testid")).toBe("login-error-alert");
        expect(alert.textContent).toContain(en);
      });

      it(`renders translated error message for "${code}" in French`, () => {
        render(<ManagerLoginPage error={code} locale="fr" />);

        const alert = screen.getByRole("alert");
        expect(alert).toBeDefined();
        expect(alert.getAttribute("data-testid")).toBe("login-error-alert");
        expect(alert.textContent).toContain(fr);
      });
    });

    it("falls back to auth_failed translation for unrecognized error code", () => {
      render(<ManagerLoginPage error="unrecognized_oauth_code" locale="en" />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(alert.textContent).toContain(getDictionary("en").auth.errors.auth_failed);
    });
  });
});
