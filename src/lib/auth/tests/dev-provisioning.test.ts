import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { maybeAutoProvisionDevManager } from "../dev-provisioning";
import * as adminModule from "@/lib/supabase/admin";
import { demoBusiness } from "@/lib/repositories/mock/fixtures";

describe("lib: auth dev-provisioning", () => {
  const mockUpsert = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockOwnersQuery = vi.fn();

  const mockAdminClient = {
    from: vi.fn((table: string) => {
      if (table === "businesses") {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
        };
      }
      if (table === "business_members") {
        return {
          upsert: mockUpsert,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => mockOwnersQuery()),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  const validGoogleUser: User = {
    id: "user-uuid-1",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { full_name: "Developer Alice" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "dev@example.com",
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("DATA_SOURCE", "supabase");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("ALLOWED_MANAGER_EMAILS", "dev@example.com");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_key");

    mockMaybeSingle.mockResolvedValue({
      data: { id: "11111111-1111-4111-8111-111111111111" },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });
    mockOwnersQuery.mockResolvedValue({ data: [], error: null });

    vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockAdminClient as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("security invariants & preconditions", () => {
    it("returns false and never calls admin client when NODE_ENV is production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("returns false and never calls admin client when APP_ENV is production", async () => {
      vi.stubEnv("APP_ENV", "production");

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("returns false and never calls admin client when APP_ENV is staging", async () => {
      vi.stubEnv("APP_ENV", "staging");

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("returns false when user email is not in ALLOWED_MANAGER_EMAILS", async () => {
      const user = { ...validGoogleUser, email: "intruder@example.com" };

      const result = await maybeAutoProvisionDevManager(user);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
    });

    it("returns false when user email is missing", async () => {
      const user = { ...validGoogleUser, email: undefined };

      const result = await maybeAutoProvisionDevManager(user);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
    });

    it("returns false when email is not confirmed (email_confirmed_at missing)", async () => {
      const user = { ...validGoogleUser, email_confirmed_at: undefined };

      const result = await maybeAutoProvisionDevManager(user);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
    });

    it("returns false when provider is password/email instead of google", async () => {
      const user: User = {
        ...validGoogleUser,
        app_metadata: { provider: "email", providers: ["email"] },
      };

      const result = await maybeAutoProvisionDevManager(user);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
    });

    it("returns false when app_metadata has no google provider", async () => {
      const user: User = {
        ...validGoogleUser,
        app_metadata: { provider: "github", providers: ["github"] },
      };

      const result = await maybeAutoProvisionDevManager(user);
      expect(result).toBe(false);
      expect(adminModule.createAdminClient).not.toHaveBeenCalled();
    });
  });

  describe("happy path & database operations", () => {
    it("provisions membership for the default demo business when DEV_BUSINESS_SLUG is unset", async () => {
      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(true);

      expect(mockAdminClient.from).toHaveBeenCalledWith("businesses");
      expect(mockEq).toHaveBeenCalledWith("slug", demoBusiness.slug);
      expect(mockAdminClient.from).toHaveBeenCalledWith("business_members");
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          business_id: demoBusiness.id,
          user_id: validGoogleUser.id,
          role: "owner",
        },
        {
          onConflict: "business_id,user_id",
        },
      );
    });

    it("provisions membership using custom DEV_BUSINESS_SLUG when configured", async () => {
      vi.stubEnv("DEV_BUSINESS_SLUG", "custom-shop-slug");

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(true);

      expect(mockEq).toHaveBeenCalledWith("slug", "custom-shop-slug");
    });

    it("returns false without throwing when business row is not found in database", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("returns false without throwing when database returns an error querying businesses", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "connection timeout" },
      });

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("returns false without throwing when upsert into business_members fails", async () => {
      mockUpsert.mockResolvedValue({ error: { message: "database constraint violation" } });

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(false);
    });

    it("provisions the first member of a business as owner", async () => {
      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: "owner" }),
        expect.anything(),
      );
    });

    it("provisions a later member as manager when the business already has another owner", async () => {
      mockOwnersQuery.mockResolvedValue({ data: [{ user_id: "someone-else" }], error: null });

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: "manager" }),
        expect.anything(),
      );
    });

    it("falls back to manager when a concurrent provision took the owner slot (23505)", async () => {
      mockUpsert
        .mockResolvedValueOnce({ error: { code: "23505", message: "duplicate key" } })
        .mockResolvedValueOnce({ error: null });

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenLastCalledWith(
        expect.objectContaining({ role: "manager" }),
        expect.anything(),
      );
    });

    it("keeps an existing owner as owner", async () => {
      mockOwnersQuery.mockResolvedValue({ data: [{ user_id: validGoogleUser.id }], error: null });

      await maybeAutoProvisionDevManager(validGoogleUser);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ role: "owner" }),
        expect.anything(),
      );
    });

    it("returns false when the owner lookup fails", async () => {
      mockOwnersQuery.mockResolvedValue({ data: null, error: { message: "boom" } });

      expect(await maybeAutoProvisionDevManager(validGoogleUser)).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("accepts provider from user.app_metadata.providers array", async () => {
      const user: User = {
        ...validGoogleUser,
        app_metadata: { providers: ["google"] },
      };

      const result = await maybeAutoProvisionDevManager(user);
      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it("succeeds in test environment (NODE_ENV=test, APP_ENV=test)", async () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("APP_ENV", "test");

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
    });
  });
});
