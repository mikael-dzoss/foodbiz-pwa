import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MOCK_AUTH_COOKIE_NAME, getManagerSession, requireManagerSession } from "../session";
import { MOCK_MANAGER_SESSION } from "@/domain/auth";
import * as devProvisioningModule from "../dev-provisioning";
import * as adminModule from "@/lib/supabase/admin";

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
let mockMembershipData: unknown = null;

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: vi.fn((table: string) => {
    if (table === "business_members") {
      return {
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit.mockReturnValue({
              maybeSingle: mockMaybeSingle.mockImplementation(async () => ({
                data: mockMembershipData,
                error: null,
              })),
            }),
          }),
        }),
      };
    }
    if (table === "businesses") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn(async () => ({
              data: {
                id: "11111111-1111-4111-8111-111111111111",
                name: "La Petite Boulangerie",
                slug: "la-petite-boulangerie",
                currency: "EUR",
              },
              error: null,
            })),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseClient),
}));

describe("lib: auth session", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    mockMembershipData = null;
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

    it("returns verified session directly from real DB when business_members row exists", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-existing-member",
            email: "manager@example.com",
            user_metadata: { name: "Alice Manager" },
          },
        },
      });

      mockMembershipData = {
        id: "member-1",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "manager",
        businesses: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "La Petite Boulangerie",
          slug: "la-petite-boulangerie",
          currency: "EUR",
        },
      };

      const spyProvision = vi.spyOn(devProvisioningModule, "maybeAutoProvisionDevManager");

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("user-existing-member");
      expect(session?.user.role).toBe("manager");
      expect(session?.business.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(session?.business.name).toBe("La Petite Boulangerie");
      expect(spyProvision).not.toHaveBeenCalled();
    });

    it("handles joined businesses array or direct business query fallback", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-array-business",
            email: "owner@example.com",
            user_metadata: { full_name: "Owner Bob" },
          },
        },
      });

      // 1. Array business join
      mockMembershipData = {
        id: "member-2",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "owner",
        businesses: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "La Petite Boulangerie",
            slug: "la-petite-boulangerie",
            currency: "EUR",
          },
        ],
      };

      let session = await getManagerSession();
      expect(session?.business.name).toBe("La Petite Boulangerie");
      expect(session?.user.role).toBe("owner");

      // 2. Direct business fallback when businesses join is null
      mockMembershipData = {
        id: "member-3",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "staff",
        businesses: null,
      };

      session = await getManagerSession();
      expect(session?.business.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(session?.business.name).toBe("La Petite Boulangerie");
      expect(session?.user.role).toBe("staff");
    });

    it("auto-provisions and returns real membership when allow-listed in development", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-dev-whitelist",
            email: "dev@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "google" },
            user_metadata: { name: "Dev Marie" },
          },
        },
      });

      // First query returns null, then after auto-provisioning re-query returns newly created membership
      mockMembershipData = null;
      vi.spyOn(devProvisioningModule, "maybeAutoProvisionDevManager").mockImplementation(
        async () => {
          mockMembershipData = {
            id: "member-auto-provisioned",
            business_id: "11111111-1111-4111-8111-111111111111",
            role: "manager",
            businesses: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "La Petite Boulangerie",
              slug: "la-petite-boulangerie",
              currency: "EUR",
            },
          };
          return true;
        },
      );

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.user.email).toBe("dev@example.com");
      expect(session?.user.name).toBe("Dev Marie");
      expect(session?.user.role).toBe("manager");
      expect(session?.business.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(session?.business.slug).toBe("la-petite-boulangerie");
      expect(devProvisioningModule.maybeAutoProvisionDevManager).toHaveBeenCalled();
    });

    it("auto-provisions and returns real membership in test environment", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("APP_ENV", "test");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "test@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-test-whitelist",
            email: "test@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "google" },
            user_metadata: { full_name: "Test Runner" },
          },
        },
      });

      mockMembershipData = null;
      vi.spyOn(devProvisioningModule, "maybeAutoProvisionDevManager").mockImplementation(
        async () => {
          mockMembershipData = {
            id: "member-test-provisioned",
            business_id: "11111111-1111-4111-8111-111111111111",
            role: "manager",
            businesses: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "La Petite Boulangerie",
              slug: "la-petite-boulangerie",
              currency: "EUR",
            },
          };
          return true;
        },
      );

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.user.email).toBe("test@example.com");
      expect(session?.user.name).toBe("Test Runner");
      expect(session?.business.id).toBe("11111111-1111-4111-8111-111111111111");
    });

    it("returns null when user email is not in ALLOWED_MANAGER_EMAILS and no membership exists", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-unauthorized",
            email: "intruder@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "google" },
          },
        },
      });

      mockMembershipData = null;

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("returns null when user email is unverified", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-unverified",
            email: "dev@example.com",
            email_confirmed_at: null,
            app_metadata: { provider: "google" },
          },
        },
      });

      mockMembershipData = null;

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("returns null when sign-in provider is not Google", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-email-auth",
            email: "dev@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "email" },
          },
        },
      });

      mockMembershipData = null;

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("returns null when target business row does not exist", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");
      vi.stubEnv("DEV_BUSINESS_SLUG", "non-existent-bakery");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-missing-biz",
            email: "dev@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "google" },
          },
        },
      });

      mockMembershipData = null;
      vi.spyOn(devProvisioningModule, "maybeAutoProvisionDevManager").mockResolvedValue(false);

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("unconditionally returns null in production when no membership exists (no admin client, no mock business)", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-prod-attempt",
            email: "dev@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "google" },
          },
        },
      });

      mockMembershipData = null;
      const spyAdmin = vi.spyOn(adminModule, "createAdminClient");

      const session = await getManagerSession();
      expect(session).toBeNull();
      expect(spyAdmin).not.toHaveBeenCalled();
    });

    it("unconditionally returns null when APP_ENV=production", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-app-prod",
            email: "dev@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "google" },
          },
        },
      });

      mockMembershipData = null;
      const spyAdmin = vi.spyOn(adminModule, "createAdminClient");

      const session = await getManagerSession();
      expect(session).toBeNull();
      expect(spyAdmin).not.toHaveBeenCalled();
    });

    it("unconditionally returns null when APP_ENV=staging", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "staging");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "user-app-staging",
            email: "dev@example.com",
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
            app_metadata: { provider: "google" },
          },
        },
      });

      mockMembershipData = null;
      const spyAdmin = vi.spyOn(adminModule, "createAdminClient");

      const session = await getManagerSession();
      expect(session).toBeNull();
      expect(spyAdmin).not.toHaveBeenCalled();
    });
  });

  describe("requireManagerSession", () => {
    it("returns session when user is authenticated with active cookie in mock mode", async () => {
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
