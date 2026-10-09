import { describe, expect, it, vi } from "vitest";
import { getPublicEnv, getServerEnv, parsePublicEnv, parseServerEnv } from "../env";

describe("parsePublicEnv", () => {
  it("returns typed values when all variables are valid", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
  });

  it("throws listing the invalid keys", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("reads from process.env via getPublicEnv", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_key";
    const env = getPublicEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
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

  it("reads from process.env via getServerEnv", () => {
    vi.stubEnv("DATA_SOURCE", "mock");
    vi.stubEnv("NODE_ENV", "development");
    try {
      const env = getServerEnv();
      expect(env.DATA_SOURCE).toBe("mock");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
