import { describe, expect, it } from "vitest";
import { buildCsp, buildSecurityHeaders } from "../security-headers";

const base = { supabaseUrl: "https://abc.supabase.co", isDev: false, secureTransport: true };

describe("buildCsp", () => {
  it("production: no eval, upgrades insecure requests, frames denied", () => {
    const csp = buildCsp(base);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("derives Supabase hosts from the URL, including the realtime socket", () => {
    const csp = buildCsp(base);
    expect(csp).toContain("img-src 'self' data: https://abc.supabase.co");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("form-action 'self' https://abc.supabase.co https://accounts.google.com");
  });

  it("dev: allows eval and ws for a local http Supabase, no upgrade", () => {
    const csp = buildCsp({
      supabaseUrl: "http://127.0.0.1:54321",
      isDev: true,
      secureTransport: false,
    });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("ws://127.0.0.1:54321");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("never emits wildcard sources and tolerates a missing or bad URL", () => {
    for (const supabaseUrl of [base.supabaseUrl, undefined, "not a url"]) {
      const csp = buildCsp({ ...base, supabaseUrl });
      expect(csp).not.toMatch(/(^|\s)\*|https?:\/\/\*|\*\./);
    }
    expect(buildCsp({ ...base, supabaseUrl: undefined })).toContain("connect-src 'self';");
  });

  it("fails closed in production builds when the Supabase URL is missing or invalid", () => {
    for (const supabaseUrl of [undefined, "not a url"]) {
      expect(() => buildCsp({ ...base, supabaseUrl, requireSupabase: true })).toThrow(
        /NEXT_PUBLIC_SUPABASE_URL/,
      );
    }
    expect(buildCsp({ ...base, requireSupabase: true })).toContain("https://abc.supabase.co");
  });
});

describe("buildSecurityHeaders", () => {
  const map = (o: Parameters<typeof buildSecurityHeaders>[0]) =>
    Object.fromEntries(buildSecurityHeaders(o).map((h) => [h.key, h.value]));

  it("sets the hardening headers", () => {
    const h = map(base);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Strict-Transport-Security"]).toBe("max-age=63072000");
  });

  it("omits HSTS without secure transport", () => {
    expect(map({ ...base, secureTransport: false })["Strict-Transport-Security"]).toBeUndefined();
  });
});
