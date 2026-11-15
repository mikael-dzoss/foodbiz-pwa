import { describe, expect, it, vi, beforeEach } from "vitest";
import { signOutAction, signInMockAction, signInWithGoogleAction } from "../actions";
import { MOCK_AUTH_COOKIE_NAME } from "@/domain/auth";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

const mockCookiesSet = vi.fn();
const mockHeadersGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookiesSet,
  })),
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
}));

const mockSignOut = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockCreateClient = vi.fn(() => ({
  auth: {
    signOut: mockSignOut,
    signInWithOAuth: mockSignInWithOAuth,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

describe("features: auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockHeadersGet.mockReturnValue(null);
  });

  describe("signOutAction", () => {
    it("sets mock cookie to signed-out and redirects to /manage/login in mock mode", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");

      await expect(signOutAction()).rejects.toThrow("REDIRECT:/manage/login");
      expect(mockCookiesSet).toHaveBeenCalledWith(
        MOCK_AUTH_COOKIE_NAME,
        "signed-out",
        expect.objectContaining({ path: "/" }),
      );
      expect(mockRedirect).toHaveBeenCalledWith("/manage/login");
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("calls supabase.auth.signOut and redirects to /manage/login in supabase mode", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");

      mockSignOut.mockResolvedValueOnce({ error: null });

      await expect(signOutAction()).rejects.toThrow("REDIRECT:/manage/login");
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(mockRedirect).toHaveBeenCalledWith("/manage/login");
    });
  });

  describe("signInMockAction", () => {
    it("sets mock cookie to active and redirects to /manage in development", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");

      await expect(signInMockAction()).rejects.toThrow("REDIRECT:/manage");
      expect(mockCookiesSet).toHaveBeenCalledWith(
        MOCK_AUTH_COOKIE_NAME,
        "active",
        expect.objectContaining({ path: "/" }),
      );
      expect(mockRedirect).toHaveBeenCalledWith("/manage");
    });

    it("throws error in production", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "production");

      await expect(signInMockAction()).rejects.toThrow(/cannot be enabled in production/i);
      expect(mockCookiesSet).not.toHaveBeenCalled();
    });
  });

  describe("signInWithGoogleAction", () => {
    describe("mock mode", () => {
      it("sets mock cookie to active and redirects to /manage when next is not provided", async () => {
        vi.stubEnv("DATA_SOURCE", "mock");
        vi.stubEnv("NODE_ENV", "development");

        await expect(signInWithGoogleAction()).rejects.toThrow("REDIRECT:/manage");
        expect(mockCookiesSet).toHaveBeenCalledWith(
          MOCK_AUTH_COOKIE_NAME,
          "active",
          expect.objectContaining({ path: "/" }),
        );
        expect(mockRedirect).toHaveBeenCalledWith("/manage");
      });

      it("respects sanitized safeNext redirect from formData", async () => {
        vi.stubEnv("DATA_SOURCE", "mock");
        vi.stubEnv("NODE_ENV", "development");

        const formData = new FormData();
        formData.set("next", "/manage/orders");

        await expect(signInWithGoogleAction(formData)).rejects.toThrow("REDIRECT:/manage/orders");
        expect(mockRedirect).toHaveBeenCalledWith("/manage/orders");
      });

      it("sanitizes open-redirect next parameter to fallback", async () => {
        vi.stubEnv("DATA_SOURCE", "mock");
        vi.stubEnv("NODE_ENV", "development");

        const formData = new FormData();
        formData.set("next", "//evil.com");

        await expect(signInWithGoogleAction(formData)).rejects.toThrow("REDIRECT:/manage");
        expect(mockRedirect).toHaveBeenCalledWith("/manage");
      });

      it("throws error in production", async () => {
        vi.stubEnv("DATA_SOURCE", "mock");
        vi.stubEnv("NODE_ENV", "production");

        await expect(signInWithGoogleAction()).rejects.toThrow(/cannot be 'mock' in production/i);
        expect(mockCookiesSet).not.toHaveBeenCalled();
      });
    });

    describe("supabase mode", () => {
      beforeEach(() => {
        vi.stubEnv("DATA_SOURCE", "supabase");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
      });

      it("prefers configured NEXT_PUBLIC_SITE_URL canonical origin and handles trailing slashes", async () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://canonical.foodbiz.app/");
        mockHeadersGet.mockImplementation((header: string) => {
          if (header === "origin") return "https://spoofed.app";
          return null;
        });

        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123" },
          error: null,
        });

        await expect(signInWithGoogleAction()).rejects.toThrow(
          "REDIRECT:https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
        );

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: "google",
          options: {
            redirectTo: "https://canonical.foodbiz.app/auth/callback?next=%2Fmanage",
          },
        });
      });

      it("in non-production without configured site URL, calls signInWithOAuth using origin header", async () => {
        vi.stubEnv("NODE_ENV", "development");
        mockHeadersGet.mockImplementation((header: string) => {
          if (header === "origin") return "https://foodbiz.app";
          return null;
        });

        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=123" },
          error: null,
        });

        await expect(signInWithGoogleAction()).rejects.toThrow(
          "REDIRECT:https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
        );

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: "google",
          options: {
            redirectTo: "https://foodbiz.app/auth/callback?next=%2Fmanage",
          },
        });
        expect(mockRedirect).toHaveBeenCalledWith(
          "https://accounts.google.com/o/oauth2/v2/auth?client_id=123",
        );
      });

      it("in non-production falls back to localhost:3000 when headers are absent", async () => {
        vi.stubEnv("NODE_ENV", "development");
        mockHeadersGet.mockReturnValue(null);
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: "https://accounts.google.com/oauth" },
          error: null,
        });

        await expect(signInWithGoogleAction()).rejects.toThrow(
          "REDIRECT:https://accounts.google.com/oauth",
        );

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: "google",
          options: {
            redirectTo: "http://localhost:3000/auth/callback?next=%2Fmanage",
          },
        });
      });

      it("in production without configured site URL, redirects to auth_failed error and refuses forwarded headers", async () => {
        vi.stubEnv("NODE_ENV", "production");
        mockHeadersGet.mockImplementation((header: string) => {
          if (header === "x-forwarded-host") return "forwarded.foodbiz.app";
          if (header === "host") return "forwarded.foodbiz.app";
          if (header === "origin") return "https://forwarded.foodbiz.app";
          return null;
        });

        await expect(signInWithGoogleAction()).rejects.toThrow(
          "REDIRECT:/manage/login?error=auth_failed",
        );
        expect(mockRedirect).toHaveBeenCalledWith("/manage/login?error=auth_failed");
        expect(mockSignInWithOAuth).not.toHaveBeenCalled();
      });

      it("sanitizes open-redirect target from next form data", async () => {
        mockHeadersGet.mockImplementation((header: string) => {
          if (header === "origin") return "http://localhost:3000";
          return null;
        });

        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: "https://accounts.google.com/oauth" },
          error: null,
        });

        const formData = new FormData();
        formData.set("next", "https://phishing.com");

        await expect(signInWithGoogleAction(formData)).rejects.toThrow(
          "REDIRECT:https://accounts.google.com/oauth",
        );

        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: "google",
          options: {
            redirectTo: "http://localhost:3000/auth/callback?next=%2Fmanage",
          },
        });
      });

      it("redirects to /manage/login?error=auth_failed when signInWithOAuth returns error", async () => {
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: null,
          error: new Error("OAuth provider error"),
        });

        await expect(signInWithGoogleAction()).rejects.toThrow(
          "REDIRECT:/manage/login?error=auth_failed",
        );
        expect(mockRedirect).toHaveBeenCalledWith("/manage/login?error=auth_failed");
      });

      it("redirects to /manage/login?error=auth_failed when url is missing from data", async () => {
        mockSignInWithOAuth.mockResolvedValueOnce({
          data: { url: "" },
          error: null,
        });

        await expect(signInWithGoogleAction()).rejects.toThrow(
          "REDIRECT:/manage/login?error=auth_failed",
        );
        expect(mockRedirect).toHaveBeenCalledWith("/manage/login?error=auth_failed");
      });
    });
  });
});
