// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SEED_BUSINESS_ID, buildEnv, parseStatus } from "./supabase-status.mjs";

const output = [
  'API_URL="http://127.0.0.1:54321"',
  'ANON_KEY="anon-value"',
  "PUBLISHABLE_KEY=pub-value",
  "Stopped services: [imgproxy]",
].join("\n");

describe("parseStatus", () => {
  it("reads quoted and bare KEY=value lines and ignores prose", () => {
    expect(parseStatus(output)).toEqual({
      API_URL: "http://127.0.0.1:54321",
      ANON_KEY: "anon-value",
      PUBLISHABLE_KEY: "pub-value",
    });
  });
});

describe("buildEnv", () => {
  it("points the build at the local stack and the seeded business", () => {
    expect(buildEnv(parseStatus(output))).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub-value",
      STOREFRONT_BUSINESS_ID: SEED_BUSINESS_ID,
      DATA_SOURCE: "supabase",
      NEXT_TELEMETRY_DISABLED: "1",
    });
  });

  it("falls back to the anon key when the stack has no publishable key", () => {
    const status = parseStatus('API_URL="http://x"\nANON_KEY="anon-value"');
    expect(buildEnv(status).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("anon-value");
  });
});
