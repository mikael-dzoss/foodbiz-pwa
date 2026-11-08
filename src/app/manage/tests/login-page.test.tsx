import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ManagerLoginPage from "../login/page";
import { getDictionary } from "@/domain/i18n";

describe("ManagerLoginPage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DATA_SOURCE", "mock");
    vi.stubEnv("NODE_ENV", "development");
  });

  it("renders manager sign-in heading, demo button, and active Google sign-in button in mock development", async () => {
    const jsx = await ManagerLoginPage();
    render(jsx);

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

  describe("M5: environment-based demo account button gating", () => {
    it("renders demo button and divider when DATA_SOURCE is mock and NODE_ENV is development", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");

      const jsx = await ManagerLoginPage();
      render(jsx);

      expect(screen.getByRole("button", { name: /sign in as manager/i })).toBeDefined();
      expect(screen.getByText(/or for development/i)).toBeDefined();
    });

    it("hides demo button and divider when DATA_SOURCE is supabase", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");

      const jsx = await ManagerLoginPage();
      render(jsx);

      expect(screen.queryByRole("button", { name: /sign in as manager/i })).toBeNull();
      expect(screen.queryByText(/or for development/i)).toBeNull();
      // Google button remains visible
      expect(screen.getByRole("button", { name: /continue with google/i })).toBeDefined();
    });

    it("hides demo button and divider in production", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");

      const jsx = await ManagerLoginPage();
      render(jsx);

      expect(screen.queryByRole("button", { name: /sign in as manager/i })).toBeNull();
      expect(screen.queryByText(/or for development/i)).toBeNull();
    });
  });

  describe("translated error states via searchParams promise", () => {
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
      it(`renders translated error message for "${code}" in English`, async () => {
        const jsx = await ManagerLoginPage({
          searchParams: Promise.resolve({ error: code, locale: "en" }),
        });
        render(jsx);

        const alert = screen.getByRole("alert");
        expect(alert).toBeDefined();
        expect(alert.getAttribute("data-testid")).toBe("login-error-alert");
        expect(alert.textContent).toContain(en);
      });

      it(`renders translated error message for "${code}" in French`, async () => {
        const jsx = await ManagerLoginPage({
          searchParams: Promise.resolve({ error: code, locale: "fr" }),
        });
        render(jsx);

        const alert = screen.getByRole("alert");
        expect(alert).toBeDefined();
        expect(alert.getAttribute("data-testid")).toBe("login-error-alert");
        expect(alert.textContent).toContain(fr);
      });
    });

    it("renders sign-out button inside no_access alert", async () => {
      const jsx = await ManagerLoginPage({
        searchParams: Promise.resolve({ error: "no_access", locale: "en" }),
      });
      render(jsx);

      const signoutBtn = screen.getByTestId("login-error-signout-btn");
      expect(signoutBtn).toBeDefined();
      expect(signoutBtn.textContent).toBe("Sign out");
    });

    it("falls back to auth_failed translation for unrecognized error code", async () => {
      const jsx = await ManagerLoginPage({
        searchParams: Promise.resolve({ error: "unrecognized_oauth_code", locale: "en" }),
      });
      render(jsx);

      const alert = screen.getByRole("alert");
      expect(alert).toBeDefined();
      expect(alert.textContent).toContain(getDictionary("en").auth.errors.auth_failed);
    });

    it("renders dedicated no-access restricted card with sign-out switch action in English", () => {
      render(<ManagerLoginPage error="no_access" locale="en" />);

      const alert = screen.getByRole("alert");
      const enDict = getDictionary("en");
      expect(alert.textContent).toContain(enDict.auth.noAccessTitle);
      expect(alert.textContent).toContain(enDict.auth.errors.no_access);

      const signOutBtn = screen.getByRole("button", {
        name: new RegExp(enDict.auth.signOutAndSwitch, "i"),
      });
      expect(signOutBtn).toBeDefined();
      expect(signOutBtn.getAttribute("id")).toBe("sign-out-switch-btn");
    });

    it("renders dedicated no-access restricted card with sign-out switch action in French", () => {
      render(<ManagerLoginPage error="no_access" locale="fr" />);

      const alert = screen.getByRole("alert");
      const frDict = getDictionary("fr");
      expect(alert.textContent).toContain(frDict.auth.noAccessTitle);
      expect(alert.textContent).toContain(frDict.auth.errors.no_access);

      const signOutBtn = screen.getByRole("button", {
        name: new RegExp(frDict.auth.signOutAndSwitch, "i"),
      });
      expect(signOutBtn).toBeDefined();
      expect(signOutBtn.getAttribute("id")).toBe("sign-out-switch-btn");
    });
  });
});
