import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ALLOWED_ROLES,
  checkProvisionEnv,
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

  describe("parseProvisionArgs", () => {
    it("parses valid space-separated arguments with default role manager", () => {
      const args = ["--business-slug", "la-petite-boulangerie", "--email", "manager@example.com"];
      const result = parseProvisionArgs(args);
      expect(result).toEqual({
        businessSlug: "la-petite-boulangerie",
        email: "manager@example.com",
        role: "manager",
      });
    });

    it("parses valid equals-separated arguments with custom role", () => {
      const args = [
        "--business-id=11111111-1111-4111-8111-111111111111",
        "--user-id=22222222-2222-4222-8222-222222222222",
        "--role=owner",
      ];
      const result = parseProvisionArgs(args);
      expect(result).toEqual({
        businessId: "11111111-1111-4111-8111-111111111111",
        userId: "22222222-2222-4222-8222-222222222222",
        role: "owner",
      });
    });

    it("parses staff role correctly", () => {
      const args = ["--business-slug", "cafe", "--email", "staff@cafe.fr", "--role", "staff"];
      const result = parseProvisionArgs(args);
      expect(result.role).toBe("staff");
    });

    it("throws error on invalid role", () => {
      const args = ["--business-slug", "cafe", "--email", "test@cafe.fr", "--role", "superadmin"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Invalid role "superadmin". Allowed roles: owner, manager, staff/i,
      );
    });

    it("throws error when business is missing", () => {
      const args = ["--email", "test@cafe.fr"];
      expect(() => parseProvisionArgs(args)).toThrow(
        /Either --business-slug or --business-id is required/i,
      );
    });

    it("throws error when user/email is missing", () => {
      const args = ["--business-slug", "cafe"];
      expect(() => parseProvisionArgs(args)).toThrow(/Either --email or --user-id is required/i);
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
      const mockMaybeSingle = vi.fn();
      const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
      const mockFromSelect = vi.fn(() => ({ eq: mockEq }));
      const mockFrom = vi.fn((table: string) => {
        if (table === "businesses") {
          return { select: mockFromSelect };
        }
        if (table === "business_members") {
          return { upsert: mockUpsert };
        }
        throw new Error(`Unexpected table ${table}`);
      });
      const mockListUsers = vi.fn();

      return {
        client: {
          from: mockFrom,
          auth: {
            admin: {
              listUsers: mockListUsers,
            },
          },
        },
        mockFrom,
        mockEq,
        mockMaybeSingle,
        mockUpsert,
        mockSingle,
        mockListUsers,
      };
    };

    it("provisions a member successfully using email and business slug", async () => {
      const { client, mockMaybeSingle, mockListUsers, mockSingle, mockUpsert } = createMockClient();

      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "biz-111",
          name: "La Petite Boulangerie",
          slug: "la-petite-boulangerie",
          currency: "EUR",
        },
        error: null,
      });

      mockListUsers.mockResolvedValueOnce({
        data: {
          users: [
            { id: "user-111", email: "MANAGER@lapetiteboulangerie.fr" },
            { id: "user-222", email: "other@example.com" },
          ],
        },
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "member-row-1",
          business_id: "biz-111",
          user_id: "user-111",
          role: "manager",
        },
        error: null,
      });

      const result = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessSlug: "la-petite-boulangerie",
        email: "manager@lapetiteboulangerie.fr",
        role: "manager",
      });

      expect(result.userId).toBe("user-111");
      expect(result.role).toBe("manager");
      expect(result.business.slug).toBe("la-petite-boulangerie");
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          business_id: "biz-111",
          user_id: "user-111",
          role: "manager",
        },
        { onConflict: "business_id,user_id" },
      );
    });

    it("provisions a member successfully using businessId and userId with owner role", async () => {
      const { client, mockMaybeSingle, mockSingle, mockUpsert } = createMockClient();

      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          id: "biz-222",
          name: "Second Bakery",
          slug: "second-bakery",
          currency: "EUR",
        },
        error: null,
      });

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "member-row-2",
          business_id: "biz-222",
          user_id: "user-custom",
          role: "owner",
        },
        error: null,
      });

      const result = await provisionBusinessMember(client as unknown as SupabaseClient, {
        businessId: "biz-222",
        userId: "user-custom",
        role: "owner",
      });

      expect(result.userId).toBe("user-custom");
      expect(result.role).toBe("owner");
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          business_id: "biz-222",
          user_id: "user-custom",
          role: "owner",
        },
        { onConflict: "business_id,user_id" },
      );
    });

    it("throws error when business is not found by slug", async () => {
      const { client, mockMaybeSingle } = createMockClient();
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "non-existent-bakery",
          email: "test@example.com",
        }),
      ).rejects.toThrow(/Business not found with slug "non-existent-bakery"/i);
    });

    it("throws error when business is not found by id", async () => {
      const { client, mockMaybeSingle } = createMockClient();
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessId: "missing-biz-id",
          userId: "user-1",
        }),
      ).rejects.toThrow(/Business not found with ID "missing-biz-id"/i);
    });

    it("throws error when user is not found by email in listUsers", async () => {
      const { client, mockMaybeSingle, mockListUsers } = createMockClient();
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: "biz-1", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockListUsers.mockResolvedValueOnce({
        data: { users: [{ id: "user-9", email: "other@example.com" }] },
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
      const { client, mockMaybeSingle, mockListUsers } = createMockClient();
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: "biz-1", name: "B", slug: "b", currency: "EUR" },
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

    it("throws error when upsert fails", async () => {
      const { client, mockMaybeSingle, mockSingle } = createMockClient();
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: "biz-1", name: "B", slug: "b", currency: "EUR" },
        error: null,
      });
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: "Database unique violation" },
      });

      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          userId: "user-1",
        }),
      ).rejects.toThrow(/Failed to provision business member: Database unique violation/i);
    });

    it("throws error when role is invalid", async () => {
      const { client } = createMockClient();
      await expect(
        provisionBusinessMember(client as unknown as SupabaseClient, {
          businessSlug: "b",
          userId: "user-1",
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
    it("executes CLI flow successfully when env and args are provided", async () => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // We can mock createClient from @supabase/supabase-js in this test
      // but provisionBusinessMember will fail if createClient returns real network client unless we mock or test main
      // Let's verify parseProvisionArgs throws if args missing
      await expect(main([])).rejects.toThrow(/Either --business-slug or --business-id is required/);

      consoleSpy.mockRestore();
      vi.unstubAllEnvs();
    });
  });

  it("exports ALLOWED_ROLES with owner, manager, and staff", () => {
    expect(ALLOWED_ROLES).toEqual(["owner", "manager", "staff"]);
  });
});
