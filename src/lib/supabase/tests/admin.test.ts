import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createAdminClient } from "../admin";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((url: string, key: string, options: unknown) => ({
    url,
    key,
    options,
    from: vi.fn(),
    auth: { admin: {} },
  })),
}));

describe("lib: supabase admin client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("production and staging guards", () => {
    it("throws when NODE_ENV is production", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-service-key");

      expect(() => createAdminClient()).toThrow(
        /Admin Supabase client cannot be created outside development or test environments/,
      );
    });

    it("throws when APP_ENV is production", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "production");
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-service-key");

      expect(() => createAdminClient()).toThrow(
        /Admin Supabase client cannot be created outside development or test environments/,
      );
    });

    it("throws when APP_ENV is staging", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "staging");
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-service-key");

      expect(() => createAdminClient()).toThrow(
        /Admin Supabase client cannot be created outside development or test environments/,
      );
    });
  });

  describe("development and test behavior", () => {
    it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "development");
      vi.stubEnv("DATA_SOURCE", "supabase");

      expect(() => createAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY is required/);
    });

    it("creates an admin client with non-persisting session options in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "development");
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-service-key");

      const client = createAdminClient();
      expect(client).toBeDefined();
      expect((client as unknown as { key: string }).key).toBe("secret-service-key");
      expect((client as unknown as { options: unknown }).options).toEqual({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    });

    it("creates an admin client in test environment", () => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("APP_ENV", "test");
      vi.stubEnv("DATA_SOURCE", "supabase");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");

      const client = createAdminClient();
      expect(client).toBeDefined();
      expect((client as unknown as { key: string }).key).toBe("test-service-key");
    });
  });

  describe("architectural boundary enforcement", () => {
    it("is never imported outside src/lib/auth and its own test", () => {
      const srcDir = path.resolve(__dirname, "../../..");
      const disallowedImports: string[] = [];

      function scanDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== "node_modules" && entry.name !== ".next") {
              scanDir(fullPath);
            }
          } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
            const relPath = path.relative(srcDir, fullPath);
            // Allowed paths: lib/supabase/admin.ts, lib/supabase/tests/admin.test.ts, lib/auth/**
            const isSelf =
              relPath === "lib/supabase/admin.ts" || relPath === "lib/supabase/tests/admin.test.ts";
            const isAuth = relPath.startsWith("lib/auth/");
            if (!isSelf && !isAuth) {
              const content = fs.readFileSync(fullPath, "utf-8");
              if (/from\s+["'].*\/supabase\/admin["']/.test(content)) {
                disallowedImports.push(relPath);
              }
            }
          }
        }
      }

      scanDir(srcDir);
      expect(disallowedImports).toEqual([]);
    });
  });
});
