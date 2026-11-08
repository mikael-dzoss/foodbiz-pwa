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

const mockGetUser = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

describe("lib: auth session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getManagerSession with DATA_SOURCE=mock", () => {
    it("returns fixture session when DATA_SOURCE=mock and session cookie is active", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue({ value: "active" });

      const session = await getManagerSession();
      expect(session).toEqual(MOCK_MANAGER_SESSION);
    });

    it("returns null when mock session cookie is missing", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue(undefined);

      const session = await getManagerSession();
      expect(session).toBeNull();
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

  describe("getManagerSession with DATA_SOURCE=supabase", () => {
    it("returns null when Supabase Auth getUser() returns null user", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("grants manager session and falls back to mock business when email is in ALLOWED_MANAGER_EMAILS in development", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@lapetiteboulangerie.fr,qa@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-whitelist-1",
            email: "DEV@lapetiteboulangerie.fr",
            user_metadata: {
              name: "Dev Marie",
            },
          },
        },
      });

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.user.email).toBe("DEV@lapetiteboulangerie.fr");
      expect(session?.user.name).toBe("Dev Marie");
      expect(session?.user.businessId).toBe(MOCK_MANAGER_SESSION.business.id);
      expect(session?.business).toEqual(MOCK_MANAGER_SESSION.business);
    });

    it("preserves provisioned business_id even when email is in ALLOWED_MANAGER_EMAILS in development", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@lapetiteboulangerie.fr");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-whitelist-2",
            email: "dev@lapetiteboulangerie.fr",
            user_metadata: {
              business_id: "22222222-2222-4222-8222-222222222222",
              business_name: "Boulangerie Centrale",
              business_slug: "boulangerie-centrale",
            },
          },
        },
      });

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.business.id).toBe("22222222-2222-4222-8222-222222222222");
      expect(session?.business.name).toBe("Boulangerie Centrale");
      expect(session?.user.businessId).toBe("22222222-2222-4222-8222-222222222222");
    });

    it("returns null when ALLOWED_MANAGER_EMAILS is configured but user email is not in the list (and no business_id is set)", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "allowed@lapetiteboulangerie.fr");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-unauthorized",
            email: "unknown@example.com",
            user_metadata: {},
          },
        },
      });

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("allows access if user has business_id provisioned even if unlisted in ALLOWED_MANAGER_EMAILS in dev", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "allowed@lapetiteboulangerie.fr");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-provisioned",
            email: "unlisted@example.com",
            user_metadata: {
              business_id: "33333333-3333-4333-8333-333333333333",
              business_name: "Provisioned Store",
              business_slug: "provisioned-store",
            },
          },
        },
      });

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.business.id).toBe("33333333-3333-4333-8333-333333333333");
    });

    it("unconditionally ignores ALLOWED_MANAGER_EMAILS when NODE_ENV=production", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@lapetiteboulangerie.fr");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-prod",
            email: "dev@lapetiteboulangerie.fr",
            user_metadata: {},
          },
        },
      });

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      // Must NOT fall back to MOCK_MANAGER_SESSION.business in production
      expect(session?.business).not.toEqual(MOCK_MANAGER_SESSION.business);
      expect(session?.business.id).toBe("");
      expect(session?.user.businessId).toBe("");
    });

    it("unconditionally ignores ALLOWED_MANAGER_EMAILS when APP_ENV=production", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@lapetiteboulangerie.fr");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-prod-app",
            email: "dev@lapetiteboulangerie.fr",
            user_metadata: {},
          },
        },
      });

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      // Must NOT fall back to MOCK_MANAGER_SESSION.business when APP_ENV is production
      expect(session?.business).not.toEqual(MOCK_MANAGER_SESSION.business);
      expect(session?.business.id).toBe("");
    });
  });

  describe("requireManagerSession", () => {
    it("returns session when user is authenticated with active cookie", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue({ value: "active" });

      const session = await requireManagerSession();
      expect(session).toEqual(MOCK_MANAGER_SESSION);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects to /manage/login when unauthenticated", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue(undefined);

      await requireManagerSession();
      expect(mockRedirect).toHaveBeenCalledWith("/manage/login");
    });
  });

  it("exports MOCK_AUTH_COOKIE_NAME", () => {
    expect(MOCK_AUTH_COOKIE_NAME).toBe("foodbiz_mock_session");
  });
});
