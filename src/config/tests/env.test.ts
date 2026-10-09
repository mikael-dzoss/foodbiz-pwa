import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "../env";

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
});
