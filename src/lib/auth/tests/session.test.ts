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
const mockGetClaims = vi.fn();
let mockMembershipData: unknown = null;

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

function createChainableQuery() {
  const query: Record<string, unknown> = {
    order: mockOrder.mockImplementation(() => query),
    limit: mockLimit.mockImplementation(() => query),
    maybeSingle: mockMaybeSingle.mockImplementation(async () => ({
      data: mockMembershipData,
      error: null,
    })),
  };
  return query;
}

const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
    getClaims: mockGetClaims,
  },
  from: vi.fn((table: string) => {
    if (table === "business_members") {
      return {
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue(createChainableQuery()),
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
                name: "Les Saveurs du Continent",
                slug: "les-saveurs-du-continent",
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
    mockRedirect.mockClear();
    mockCookiesGet.mockClear();
    mockMembershipData = null;
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          exp: 1893456000, // 2030-01-01T00:00:00Z
        },
      },
      error: null,
    });
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

      await expect(getManagerSession()).rejects.toThrow();
    });
  });

  describe("getManagerSession with DATA_SOURCE=supabase", () => {
    it("returns null when Supabase Auth getUser() returns null user", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");

      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("returns null when user has no email", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "",
          },
        },
      });

      const session = await getManagerSession();
      expect(session).toBeNull();
    });

    it("returns verified session directly from real DB when business_members row exists", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "manager@example.com",
            user_metadata: { name: "Alice Manager" },
          },
        },
      });

      mockMembershipData = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "manager",
        businesses: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Les Saveurs du Continent",
          slug: "les-saveurs-du-continent",
          currency: "EUR",
        },
      };

      const spyProvision = vi.spyOn(devProvisioningModule, "maybeAutoProvisionDevManager");

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe("00000000-0000-4000-8000-000000000001");
      expect(session?.user.role).toBe("manager");
      expect(session?.business.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(session?.business.name).toBe("Les Saveurs du Continent");
      expect(session?.expiresAt).toBe(new Date(1893456000 * 1000).toISOString());
      expect(spyProvision).not.toHaveBeenCalled();
    });

    it("derives expiresAt as null when getClaims returns no exp", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            email: "manager@example.com",
          },
        },
      });

      mockMembershipData = {
        id: "11111111-1111-4111-8111-111111111111",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "manager",
        businesses: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Les Saveurs du Continent",
          slug: "les-saveurs-du-continent",
          currency: "EUR",
        },
      };

      mockGetClaims.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const session = await getManagerSession();
      expect(session).not.toBeNull();
      expect(session?.expiresAt).toBeNull();
    });

    it("handles joined businesses array or direct business query fallback", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "development");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000002",
            email: "owner@example.com",
            user_metadata: { full_name: "Owner Bob" },
          },
        },
      });

      // 1. Array business join
      mockMembershipData = {
        id: "22222222-2222-4222-8222-222222222222",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "owner",
        businesses: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Les Saveurs du Continent",
            slug: "les-saveurs-du-continent",
            currency: "EUR",
          },
        ],
      };

      let session = await getManagerSession();
      expect(session?.business.name).toBe("Les Saveurs du Continent");
      expect(session?.user.role).toBe("owner");

      // 2. Direct business fallback when businesses join is null
      mockMembershipData = {
        id: "33333333-3333-4333-8333-333333333333",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "staff",
        businesses: null,
      };

      session = await getManagerSession();
      expect(session?.business.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(session?.business.name).toBe("Les Saveurs du Continent");
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
            id: "00000000-0000-4000-8000-000000000003",
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
            id: "44444444-4444-4444-8444-444444444444",
            business_id: "11111111-1111-4111-8111-111111111111",
            role: "manager",
            businesses: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Les Saveurs du Continent",
              slug: "les-saveurs-du-continent",
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
      expect(session?.business.slug).toBe("les-saveurs-du-continent");
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
            id: "00000000-0000-4000-8000-000000000004",
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
            id: "55555555-5555-4555-8555-555555555555",
            business_id: "11111111-1111-4111-8111-111111111111",
            role: "manager",
            businesses: {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Les Saveurs du Continent",
              slug: "les-saveurs-du-continent",
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
            id: "00000000-0000-4000-8000-000000000005",
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
            id: "00000000-0000-4000-8000-000000000006",
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
            id: "00000000-0000-4000-8000-000000000007",
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
      vi.stubEnv("DEV_BUSINESS_SLUG", "non-existent-shop");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000008",
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
            id: "00000000-0000-4000-8000-000000000009",
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
            id: "00000000-0000-4000-8000-000000000010",
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
            id: "00000000-0000-4000-8000-000000000011",
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

    it("redirects to /manage/login when unauthenticated in mock mode", async () => {
      vi.stubEnv("DATA_SOURCE", "mock");
      vi.stubEnv("NODE_ENV", "development");
      mockCookiesGet.mockReturnValue(undefined);

      await requireManagerSession();
      expect(mockRedirect).toHaveBeenCalledWith("/manage/login");
    });

    it("redirects signed-in non-members to /manage/login?error=no_access when DATA_SOURCE=supabase", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000099",
            email: "stranger@example.com",
          },
        },
      });
      mockMembershipData = null;

      await requireManagerSession();
      expect(mockRedirect).toHaveBeenCalledWith("/manage/login?error=no_access");
    });

    it("redirects unauthenticated (no user) to /manage/login when DATA_SOURCE=supabase", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");

      mockGetUser.mockResolvedValue({
        data: {
          user: null,
        },
      });

      await requireManagerSession();
      expect(mockRedirect).toHaveBeenCalledWith("/manage/login");
    });

    it("returns session without redirect when user has verified business membership in supabase mode", async () => {
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("NODE_ENV", "production");

      mockGetUser.mockResolvedValue({
        data: {
          user: {
            id: "00000000-0000-4000-8000-000000000012",
            email: "manager@example.com",
          },
        },
      });
      mockMembershipData = {
        id: "66666666-6666-4666-8666-666666666666",
        business_id: "11111111-1111-4111-8111-111111111111",
        role: "manager",
        businesses: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Verified Shop",
          slug: "verified-shop",
          currency: "EUR",
        },
      };

      const session = await requireManagerSession();
      expect(session.user.id).toBe("00000000-0000-4000-8000-000000000012");
      expect(session.user.businessId).toBe("11111111-1111-4111-8111-111111111111");
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  it("exports MOCK_AUTH_COOKIE_NAME", () => {
    expect(MOCK_AUTH_COOKIE_NAME).toBe("foodbiz_mock_session");
  });
});
