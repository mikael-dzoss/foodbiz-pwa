import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MOCK_AUTH_COOKIE_NAME, getManagerSession, requireManagerSession } from "../session";
import { MOCK_MANAGER_SESSION } from "@/domain/auth";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockCookiesGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
  })),
}));

describe("lib: auth session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getManagerSession", () => {
    it("returns fixture session when DATA_SOURCE=mock and not signed out", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue(undefined);

      const session = await getManagerSession();
      expect(session).toEqual(MOCK_MANAGER_SESSION);
    });

    it("returns null when mock session cookie is set to signed-out", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue({ value: "signed-out" });

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("throws error when DATA_SOURCE=mock in production (impossible in production)", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "production");

      await expect(getManagerSession()).rejects.toThrow(/cannot be enabled in production/i);
    });
  });

  describe("requireManagerSession", () => {
    it("returns session when user is authenticated", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue(undefined);

      const session = await requireManagerSession();
      expect(session).toEqual(MOCK_MANAGER_SESSION);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects to /manage/login when unauthenticated", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue({ value: "signed-out" });

      await requireManagerSession();
      expect(mockRedirect).toHaveBeenCalledWith("/manage/login");
    });
  });

  it("exports MOCK_AUTH_COOKIE_NAME", () => {
    expect(MOCK_AUTH_COOKIE_NAME).toBe("foodbiz_mock_session");
  });
});
