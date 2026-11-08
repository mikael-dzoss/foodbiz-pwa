import { describe, expect, it, vi } from "vitest";
import { getPublicEnv, getServerEnv, parsePublicEnv, parseServerEnv } from "../env";

describe("parsePublicEnv", () => {
  it("returns typed values when all variables are valid", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
      NEXT_PUBLIC_SITE_URL: "https://foodbiz.example.com",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://foodbiz.example.com");
  });

  it("allows omitting optional NEXT_PUBLIC_SITE_URL or passing empty string", () => {
    const envOmitted = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
    });
    expect(envOmitted.NEXT_PUBLIC_SITE_URL).toBeUndefined();

    const envEmpty = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
      NEXT_PUBLIC_SITE_URL: "",
    });
    expect(envEmpty.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it("throws listing the invalid keys", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
        NEXT_PUBLIC_SITE_URL: "not-a-valid-url",
      }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("reads from process.env via getPublicEnv", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_key";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const env = getPublicEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });
});

describe("parseServerEnv", () => {
  it("defaults DATA_SOURCE to mock when omitted in non-production", () => {
    const env = parseServerEnv({ NODE_ENV: "development" });
    expect(env.DATA_SOURCE).toBe("mock");
  });

  it("accepts DATA_SOURCE=mock in development", () => {
    const env = parseServerEnv({ DATA_SOURCE: "mock", NODE_ENV: "development" });
    expect(env.DATA_SOURCE).toBe("mock");
  });

  it("accepts DATA_SOURCE=supabase in production", () => {
    const env = parseServerEnv({ DATA_SOURCE: "supabase", NODE_ENV: "production" });
    expect(env.DATA_SOURCE).toBe("supabase");
  });

  it("rejects DATA_SOURCE=mock in production", () => {
    expect(() => parseServerEnv({ DATA_SOURCE: "mock", NODE_ENV: "production" })).toThrow(
      /DATA_SOURCE cannot be 'mock' in production/,
    );
  });

  it("rejects default mock in production when DATA_SOURCE is omitted", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(
      /DATA_SOURCE cannot be 'mock' in production/,
    );
  });

  it("rejects invalid DATA_SOURCE values", () => {
    expect(() => parseServerEnv({ DATA_SOURCE: "redis" as never })).toThrow(
      /Invalid server environment variables/,
    );
  });

  it("accepts valid APP_ENV values and optional ALLOWED_MANAGER_EMAILS", () => {
    const env = parseServerEnv({
      DATA_SOURCE: "supabase",
      NODE_ENV: "production",
      APP_ENV: "staging",
      ALLOWED_MANAGER_EMAILS: "admin@lapetiteboulangerie.fr",
    });
    expect(env.APP_ENV).toBe("staging");
    expect(env.ALLOWED_MANAGER_EMAILS).toBe("admin@lapetiteboulangerie.fr");
  });

  it("rejects invalid APP_ENV values", () => {
    expect(() =>
      parseServerEnv({
        DATA_SOURCE: "mock",
        NODE_ENV: "development",
        APP_ENV: "invalid-env" as never,
      }),
    ).toThrow(/Invalid server environment variables/);
  });

  it("reads from process.env via getServerEnv", () => {
    vi.stubEnv("DATA_SOURCE", "mock");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("ALLOWED_MANAGER_EMAILS", "qa@example.com");
    try {
      const env = getServerEnv();
      expect(env.DATA_SOURCE).toBe("mock");
      expect(env.APP_ENV).toBe("test");
      expect(env.ALLOWED_MANAGER_EMAILS).toBe("qa@example.com");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
