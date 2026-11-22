import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ALLOWED_ROLES,
  checkProvisionEnv,
  isLocalHost,
  main,
  parseProvisionArgs,
  provisionBusinessMember,
} from "./provision-member.mjs";

type SupabaseClient = Parameters<typeof provisionBusinessMember>[0];
type ProvisionRole = NonNullable<Parameters<typeof provisionBusinessMember>[1]>["role"];

describe("scripts: provision-member", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isLocalHost", () => {
    it("identifies local hostnames accurately", () => {
      expect(isLocalHost("localhost")).toBe(true);
      expect(isLocalHost("127.0.0.1")).toBe(true);
      expect(isLocalHost("::1")).toBe(true);
      expect(isLocalHost("host.docker.internal")).toBe(true);
      expect(isLocalHost("sub.localhost")).toBe(true);
    });

    it("identifies remote and production hostnames as non-local", () => {
      expect(isLocalHost("your-project-ref.supabase.co")).toBe(false);
      expect(isLocalHost("api.foodbiz.fr")).toBe(false);
      expect(isLocalHost("db.example.internal")).toBe(false);
      expect(isLocalHost("")).toBe(false);
    });
  });

  describe("parseProvisionArgs", () => {
    it("parses valid space-separated arguments leaving the role to be decided at provisioning", () => {
      const args = [
        "--business-slug",
        "les-saveurs-du-continent",
        "--email",
        "manager@example.com",
      ];
      const result = parseProvisionArgs(args);
      expect(result).toEqual({
        businessSlug: "les-saveurs-du-continent",
        email: "manager@example.com",
        role: undefined,
        yes: false,
        force: false,
      });
    });

    it("parses valid equals-separated arguments with custom role, --yes, and --force", () => {
      const args = [
        "--business-id=11111111-1111-4111-8111-111111111111",
        "--user-id=22222222-2222-4222-8222-222222222222",
        "--role=owner",
        "--yes",
        "--force",
      ];
      const result = parseProvisionArgs(args);
      expect(result).toEqual({
        businessId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        role: "owner",
        yes: true,
        force: true,
      });
    });

    it("parses staff role and flag formats --yes=true and --force=true", () => {
      const args = [
        "--business-slug",
        "cafe",
        "--email",
        "staff@cafe.fr",
        "--role",
        "staff",
        "--yes=true",
        "--force=true",
      ];
      const result = parseProvisionArgs(args);
      expect(result.role).toBe("staff");
      expect(result.yes).toBe(true);
      expect(result.force).toBe(true);
    });

    it("throws error on invalid role", () => {
      const args = ["--business-slug", "cafe", "--email", "test@cafe.fr", "--role", "superadmin"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Invalid role "superadmin". Allowed roles: owner, manager, staff/i,
      );
    });

    it("throws error when both business-slug and business-id are provided", () => {
      const args = [
        "--business-slug",
        "cafe",
        "--business-id",
        "11111111-1111-4111-8111-111111111111",
        "--email",
        "test@cafe.fr",
      ];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Exactly one of --business-slug or --business-id must be specified/i,
      );
    });

    it("throws error when neither business-slug nor business-id is provided", () => {
      const args = ["--email", "test@cafe.fr"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Exactly one of --business-slug or --business-id must be specified/i,
      );
    });

    it("throws error when both email and user-id are provided", () => {
      const args = [
        "--business-slug",
        "cafe",
        "--email",
        "test@cafe.fr",
        "--user-id",
        "22222222-2222-4222-8222-222222222222",
      ];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Exactly one of --email or --user-id must be specified/i,
      );
    });

    it("throws error when neither email nor user-id is provided", () => {
      const args = ["--business-slug", "cafe"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Exactly one of --email or --user-id must be specified/i,
      );
    });

    it("throws error when email format is invalid", () => {
      const args = ["--business-slug", "cafe", "--email", "not-an-email"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Invalid email address format: "not-an-email"/i,
      );
    });

    it("throws error when business-id UUID format is invalid", () => {
      const args = ["--business-id", "invalid-uuid", "--email", "user@example.com"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Invalid UUID format for --business-id: "invalid-uuid"/i,
      );
    });

    it("throws error when user-id UUID format is invalid", () => {
      const args = ["--business-slug", "cafe", "--user-id", "invalid-user-uuid"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Invalid UUID format for --user-id: "invalid-user-uuid"/i,
      );
    });
  });

  describe("checkProvisionEnv", () => {
    it("throws error when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
      const env = {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      };
      expect(() => checkProvisionEnv(env)).toThrow(
        /Missing SUPABASE_SERVICE_ROLE_KEY environment variable/i,
      );
    });

    it("throws error when URL is missing", () => {
      const env = {
        SUPABASE_SERVICE_ROLE_KEY: "secret-key",
      };
      expect(() => checkProvisionEnv(env)).toThrow(
        /Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable/i,
      );
    });

    it("resolves supabaseUrl from NEXT_PUBLIC_SUPABASE_URL", () => {
      const env = {
        NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret-key",
      };
      const result = checkProvisionEnv(env);
      expect(result).toEqual({
        supabaseUrl: "https://public.supabase.co",
        serviceRoleKey: "secret-key",
      });
    });

    it("resolves supabaseUrl from SUPABASE_URL fallback", () => {
      const env = {
        SUPABASE_URL: "https://server.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret-key",
      };
      const result = checkProvisionEnv(env);
      expect(result).toEqual({
        supabaseUrl: "https://server.supabase.co",
        serviceRoleKey: "secret-key",
      });
    });
  });

  describe("provisionBusinessMember", () => {
    const createMockClient = () => {
      const mockSingle = vi.fn();
      const mockSelect = vi.fn(() => ({ single: mockSingle }));
      const mockUpsert = vi.fn(() => ({ select: mockSelect }));

      const mockBusinessMaybeSingle = vi.fn();
      const mockBusinessEq = vi.fn(() => ({ maybeSingle: mockBusinessMaybeSingle }));
      const mockBusinessSelect = vi.fn(() => ({ eq: mockBusinessEq }));

      const mockMemberMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      // The owner lookup (`.eq(business).eq("role", "owner")`) is awaited directly: thenable result.
      const ownersResult: { data: Array<{ user_id: string }>; error: null } = {
        data: [],
        error: null,
      };
      const mockMemberEqUser = vi.fn(() => ({
        maybeSingle: mockMemberMaybeSingle,
        then: (resolve: (value: typeof ownersResult) => unknown) => resolve(ownersResult),
      }));
      const mockMemberEqBiz = vi.fn(() => ({ eq: mockMemberEqUser }));
      const mockMemberSelect = vi.fn(() => ({ eq: mockMemberEqBiz }));

      const mockFrom = vi.fn((table: string) => {
        if (table === "businesses") {
          return { select: mockBusinessSelect };
        }
        if (table === "business_members") {
          return {
            select: mockMemberSelect,
            upsert: mockUpsert,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      });

      const mockListUsers = vi.fn();
      const mockGetUserById = vi.fn();

      return {
        client: {
          from: mockFrom,
          auth: {
            admin: {
              listUsers: mockListUsers,
              getUserById: mockGetUserById,
            },
          },
        },
        mockFrom,
        ownersResult,
        mockBusinessMaybeSingle,
        mockMemberMaybeSingle,
        mockUpsert,
        mockSingle,
        mockListUsers,
        mockGetUserById,
      };
    };

    it("provisions a member successfully across paginated listUsers (found on page 2)", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockSingle, mockUpsert } =
        createMockClient();

      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Les Saveurs du Continent",
          slug: "les-saveurs-du-continent",
          currency: "EUR",
        },
        error: null,
      });

      // Page 1: 200 users, target not present
      const page1Users = Array.from({ length: 200 }, (_, idx) => ({
        id: `00000000-0000-4000-8000-${String(idx).padStart(12, "0")}`,
        email: `other${idx}@example.com`,
      }));
      mockListUsers.mockResolvedValueOnce({
        data: { users: page1Users },
        error: null,
      });

      // Page 2: target user is found
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              email: "MANAGER@example.com",
            },
          ],
        },
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "manager",
        },
        error: null,
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "les-saveurs-du-continent",
        email: "manager@example.com",
        role: "manager",
      });

      expect(mockListUsers).toHaveBeenCalledTimes(2);
      expect(mockListUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 });
      expect(mockListUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
      expect(result.userId).toBe("22222222-2222-4222-8222-222222222222");
      expect(result.role).toBe("manager");
      expect(result.business.slug).toBe("les-saveurs-du-continent");
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "manager",
        },
        { onConflict: "business_id,user_id" },
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Provisioning member: host=localhost"),
      );

      consoleSpy.mockRestore();
    });

    it("makes the first member of a business its owner when no role is given", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockSingle, mockUpsert } =
        createMockClient();
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: { users: [{ id: "22222222-2222-4222-8222-222222222222", email: "a@example.com" }] },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: { id: "m" }, error: null });
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const res = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "b",
        email: "a@example.com",
      });

      expect(res.role).toBe("owner");
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: "owner" }),
        expect.anything(),
      );
      consoleSpy.mockRestore();
    });

    it("falls back to manager when a concurrent run took the owner slot (23505)", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockSingle } = createMockClient();
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: { users: [{ id: "22222222-2222-4222-8222-222222222222", email: "a@example.com" }] },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      });
      mockSingle.mockResolvedValueOnce({ data: { id: "m" }, error: null });
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const res = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "b",
        email: "a@example.com",
      });

      expect(res.role).toBe("manager");
      consoleSpy.mockRestore();
    });

    it("fails with a clear message when an explicit owner role hits the owner slot (23505)", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockSingle } = createMockClient();
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: { users: [{ id: "22222222-2222-4222-8222-222222222222", email: "a@example.com" }] },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      });
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          email: "a@example.com",
          role: "owner",
        }),
      ).rejects.toThrow(/already has an owner/i);
      consoleSpy.mockRestore();
    });

    it("makes a later member a manager when the business already has an owner", async () => {
      const { client, ownersResult, mockBusinessMaybeSingle, mockListUsers, mockSingle } =
        createMockClient();
      ownersResult.data = [{ user_id: "99999999-9999-4999-8999-999999999999" }];
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: { users: [{ id: "22222222-2222-4222-8222-222222222222", email: "a@example.com" }] },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({ data: { id: "m" }, error: null });
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const res = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "b",
        email: "a@example.com",
      });

      expect(res.role).toBe("manager");
      consoleSpy.mockRestore();
    });

    it("provisions a member using userId path via auth.admin.getUserById", async () => {
      const { client, mockBusinessMaybeSingle, mockGetUserById, mockSingle, mockUpsert } =
        createMockClient();

      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Second Shop",
          slug: "second-shop",
          currency: "EUR",
        },
        error: null,
      });

      mockGetUserById.mockResolvedValueOnce({
        data: {
          user: {
            id: "22222222-2222-4222-8222-222222222222",
            email: "owner@secondshop.example.com",
          },
        },
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "44444444-4444-4444-8444-444444444444",
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "owner",
        },
        error: null,
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        role: "owner",
      });

      expect(mockGetUserById).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
      expect(result.userId).toBe("22222222-2222-4222-8222-222222222222");
      expect(result.role).toBe("owner");
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "owner",
        },
        { onConflict: "business_id,user_id" },
      );

      consoleSpy.mockRestore();
    });

    it("guards non-local host targets unless --yes is explicitly supplied", async () => {
      const { client } = createMockClient();

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "les-saveurs-du-continent",
          email: "manager@example.com",
          targetHost: "your-project-ref.supabase.co",
          yes: false,
        }),
      ).rejects.toThrow(
        /Refusing to write to non-local target host "your-project-ref.supabase.co" without explicit confirmation/i,
      );
    });

    it("allows non-local host targets when --yes is supplied", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockSingle } = createMockClient();

      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Prod Shop",
          slug: "prod-shop",
          currency: "EUR",
        },
        error: null,
      });

      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: "22222222-2222-4222-8222-222222222222", email: "manager@example.com" }],
        },
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "33333333-3333-4333-8333-333333333333",
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "manager",
        },
        error: null,
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const res = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "prod-shop",
        email: "manager@example.com",
        targetHost: "your-project-ref.supabase.co",
        yes: true,
      });

      expect(res.business.slug).toBe("prod-shop");
      consoleSpy.mockRestore();
    });

    it("refuses to change an existing member's role unless --force is supplied", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockMemberMaybeSingle } =
        createMockClient();

      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Shop",
          slug: "shop",
          currency: "EUR",
        },
        error: null,
      });

      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: "22222222-2222-4222-8222-222222222222", email: "user@example.com" }],
        },
        error: null,
      });

      // Existing membership has role "owner" while request attempts role "staff"
      mockMemberMaybeSingle.mockResolvedValueOnce({
        data: { id: "member-existing-id", role: "owner" },
        error: null,
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "shop",
          email: "user@example.com",
          role: "staff",
          force: false,
        }),
      ).rejects.toThrow(
        /User is already a member of business "shop" with role "owner". Refusing to change role to "staff" without --force flag/i,
      );
    });

    it("allows role change when --force is supplied", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockMemberMaybeSingle, mockSingle } =
        createMockClient();

      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Shop",
          slug: "shop",
          currency: "EUR",
        },
        error: null,
      });

      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: "22222222-2222-4222-8222-222222222222", email: "user@example.com" }],
        },
        error: null,
      });

      mockMemberMaybeSingle.mockResolvedValueOnce({
        data: { id: "member-existing-id", role: "owner" },
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "member-existing-id",
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "staff",
        },
        error: null,
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const res = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "shop",
        email: "user@example.com",
        role: "staff",
        force: true,
      });

      expect(res.role).toBe("staff");
      consoleSpy.mockRestore();
    });

    it("allows idempotent provisioning without --force when existing membership has identical role", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockMemberMaybeSingle, mockSingle } =
        createMockClient();

      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Shop",
          slug: "shop",
          currency: "EUR",
        },
        error: null,
      });

      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: "22222222-2222-4222-8222-222222222222", email: "user@example.com" }],
        },
        error: null,
      });

      // Existing membership already has role "manager"
      mockMemberMaybeSingle.mockResolvedValueOnce({
        data: { id: "member-existing-id", role: "manager" },
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "member-existing-id",
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: "22222222-2222-4222-8222-222222222222",
          role: "manager",
        },
        error: null,
      });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const res = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "shop",
        email: "user@example.com",
        role: "manager",
        force: false,
      });

      expect(res.role).toBe("manager");
      consoleSpy.mockRestore();
    });

    it("distinguishes business query error from business not found by slug", async () => {
      const { client, mockBusinessMaybeSingle } = createMockClient();

      // 1. Query error
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection timeout" },
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "shop",
          email: "user@example.com",
        }),
      ).rejects.toThrow(/Failed to query business: Database connection timeout/i);

      // 2. Not found
      mockBusinessMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "shop",
          email: "user@example.com",
        }),
      ).rejects.toThrow(/Business not found with slug "shop"/i);
    });

    it("distinguishes business query error from business not found by id", async () => {
      const { client, mockBusinessMaybeSingle } = createMockClient();

      // 1. Query error
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Permission denied" },
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessId: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
        }),
      ).rejects.toThrow(/Failed to query business: Permission denied/i);

      // 2. Not found
      mockBusinessMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessId: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
        }),
      ).rejects.toThrow(/Business not found with ID "11111111-1111-4111-8111-111111111111"/i);
    });

    it("distinguishes user query error from user not found by userId", async () => {
      const { client, mockBusinessMaybeSingle, mockGetUserById } = createMockClient();

      mockBusinessMaybeSingle.mockResolvedValue({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });

      // 1. Query error
      mockGetUserById.mockResolvedValueOnce({
        data: null,
        error: { message: "Internal Auth Error" },
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessId: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
        }),
      ).rejects.toThrow(/Failed to query user: Internal Auth Error/i);

      // 2. Not found
      mockGetUserById.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessId: "11111111-1111-4111-8111-111111111111",
          userId: "22222222-2222-4222-8222-222222222222",
        }),
      ).rejects.toThrow(/User not found with ID "22222222-2222-4222-8222-222222222222"/i);
    });

    it("throws error when user is not found by email after full pagination", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers } = createMockClient();
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: "22222222-2222-4222-8222-222222222222", email: "other@example.com" }],
        },
        error: null,
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          email: "missing@example.com",
        }),
      ).rejects.toThrow(/User not found with email "missing@example.com"/i);
    });

    it("throws error when listUsers fails", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers } = createMockClient();
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: null,
        error: { message: "Auth service down" },
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          email: "user@example.com",
        }),
      ).rejects.toThrow(/Failed to list users: Auth service down/i);
    });

    it("throws error when existing membership query fails", async () => {
      const { client, mockBusinessMaybeSingle, mockListUsers, mockMemberMaybeSingle } =
        createMockClient();

      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [{ id: "22222222-2222-4222-8222-222222222222", email: "user@example.com" }],
        },
        error: null,
      });
      mockMemberMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Connection lost" },
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          email: "user@example.com",
        }),
      ).rejects.toThrow(/Failed to query existing membership: Connection lost/i);
    });

    it("throws error when upsert fails", async () => {
      const { client, mockBusinessMaybeSingle, mockSingle, mockGetUserById } = createMockClient();
      mockBusinessMaybeSingle.mockResolvedValueOnce({
        data: { id: "11111111-1111-4111-8111-111111111111", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockGetUserById.mockResolvedValueOnce({
        data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Database unique violation" },
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          userId: "22222222-2222-4222-8222-222222222222",
        }),
      ).rejects.toThrow(/Failed to provision business member: Database unique violation/i);
    });

    it("throws error when role is invalid", async () => {
      const { client } = createMockClient();
      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          userId: "22222222-2222-4222-8222-222222222222",
          role: "invalid-role" as unknown as ProvisionRole,
        }),
      ).rejects.toThrow(/Invalid role "invalid-role"/i);
    });

    it("throws error when client is missing", async () => {
      await expect(provisionBusinessMember(null as unknown as SupabaseClient, {})).rejects.toThrow(
        /Supabase client is required/i,
      );
    });
  });

  describe("main", () => {
    it("throws if CLI args fail validation", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");

      await expect(main([])).rejects.toThrow(
        /Exactly one of --business-slug or --business-id must be specified/,
      );

      vi.unstubAllEnvs();
    });
  });

  it("exports ALLOWED_ROLES with owner, manager, and staff", () => {
    expect(ALLOWED_ROLES).toEqual(["owner", "manager", "staff"]);
  });
});
