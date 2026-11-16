import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { User } from "@supabase/supabase-js";
import { maybeAutoProvisionDevManager } from "../dev-provisioning";
import * as adminModule from "@/lib/supabase/admin";

describe("lib: auth dev-provisioning", () => {
  const mockUpsert = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();

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
      expect(mockEq).toHaveBeenCalledWith("slug", "la-petite-boulangerie");
      expect(mockAdminClient.from).toHaveBeenCalledWith("business_members");
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          business_id: "11111111-1111-4111-8111-111111111111",
          user_id: validGoogleUser.id,
          role: "manager",
        },
        {
          onConflict: "business_id,user_id",
        },
      );
    });

    it("provisions membership using custom DEV_BUSINESS_SLUG when configured", async () => {
      vi.stubEnv("DEV_BUSINESS_SLUG", "custom-bakery-slug");

      const result = await maybeAutoProvisionDevManager(validGoogleUser);
      expect(result).toBe(true);

      expect(mockEq).toHaveBeenCalledWith("slug", "custom-bakery-slug");
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
