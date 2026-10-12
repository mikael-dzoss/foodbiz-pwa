import { describe, expect, it, vi, beforeEach } from "vitest";
import { signOutAction, signInMockAction } from "../actions";
import { MOCK_AUTH_COOKIE_NAME } from "@/domain/auth";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

const mockCookiesSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: mockCookiesSet,
  })),
}));

describe("features: auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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
});
