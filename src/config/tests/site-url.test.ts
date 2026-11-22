import { describe, expect, it } from "vitest";
import { getSiteUrl, resolveAuthBaseUrl } from "../site-url";

describe("getSiteUrl", () => {
  it("parses a valid URL and trims whitespace", () => {
    expect(getSiteUrl("  https://foodbiz.example.com  ")?.origin).toBe(
      "https://foodbiz.example.com",
    );
  });

  it("returns undefined for empty or invalid values", () => {
    expect(getSiteUrl(undefined)).toBeUndefined();
    expect(getSiteUrl("")).toBeUndefined();
    expect(getSiteUrl("   ")).toBeUndefined();
    expect(getSiteUrl("not-a-url")).toBeUndefined();
  });
});

describe("resolveAuthBaseUrl", () => {
  const VERCEL_URL = "foodbiz-pwa-abc123-team.vercel.app";
  const VERCEL_BRANCH_URL = "foodbiz-pwa-git-feat-preview-team.vercel.app";

  describe("branch (a): NEXT_PUBLIC_SITE_URL configured", () => {
    it("returns the configured site URL with trailing slashes stripped", () => {
      expect(
        resolveAuthBaseUrl({
          siteUrl: "https://foodbiz-pwa-git-staging-team.vercel.app///",
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: VERCEL_URL,
          vercelBranchUrl: VERCEL_BRANCH_URL,
          requestOrigin: "https://evil.example.com",
        }),
      ).toBe("https://foodbiz-pwa-git-staging-team.vercel.app");
    });

    it("ignores whitespace-only siteUrl and continues to the next branch", () => {
      expect(
        resolveAuthBaseUrl({
          siteUrl: "   ",
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: VERCEL_URL,
          vercelBranchUrl: VERCEL_BRANCH_URL,
          requestOrigin: `https://${VERCEL_URL}`,
        }),
      ).toBe(`https://${VERCEL_URL}`);
    });
  });

  describe("branch (b): Vercel preview deployments (VERCEL_ENV=preview)", () => {
    it("accepts the request origin when it exactly equals https://${VERCEL_URL}", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: VERCEL_URL,
          vercelBranchUrl: VERCEL_BRANCH_URL,
          requestOrigin: `https://${VERCEL_URL}`,
        }),
      ).toBe(`https://${VERCEL_URL}`);
    });

    it("accepts the request origin when it exactly equals https://${VERCEL_BRANCH_URL}", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: VERCEL_URL,
          vercelBranchUrl: VERCEL_BRANCH_URL,
          requestOrigin: `https://${VERCEL_BRANCH_URL}`,
        }),
      ).toBe(`https://${VERCEL_BRANCH_URL}`);
    });

    it("ignores a spoofed origin on preview and falls back to VERCEL_BRANCH_URL", () => {
      for (const spoofedOrigin of [
        "https://evil.example.com",
        `https://${VERCEL_URL}.evil.com`,
        `http://${VERCEL_URL}`,
        `https://${VERCEL_URL}/`,
        `https://${VERCEL_BRANCH_URL}:8443`,
      ]) {
        expect(
          resolveAuthBaseUrl({
            nodeEnv: "production",
            vercelEnv: "preview",
            vercelUrl: VERCEL_URL,
            vercelBranchUrl: VERCEL_BRANCH_URL,
            requestOrigin: spoofedOrigin,
          }),
          spoofedOrigin,
        ).toBe(`https://${VERCEL_BRANCH_URL}`);
      }
    });

    it("falls back to VERCEL_BRANCH_URL when origin header is absent on preview", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: VERCEL_URL,
          vercelBranchUrl: VERCEL_BRANCH_URL,
          requestOrigin: null,
        }),
      ).toBe(`https://${VERCEL_BRANCH_URL}`);
    });

    it("falls back to VERCEL_URL when VERCEL_BRANCH_URL is unset and origin is absent or spoofed", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: VERCEL_URL,
          requestOrigin: "https://spoofed.example.com",
        }),
      ).toBe(`https://${VERCEL_URL}`);

      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: VERCEL_URL,
          requestOrigin: null,
        }),
      ).toBe(`https://${VERCEL_URL}`);
    });

    it("returns null (fail closed) on preview when neither VERCEL_BRANCH_URL nor VERCEL_URL is valid", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          requestOrigin: "https://spoofed.example.com",
        }),
      ).toBeNull();

      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: "https://has-protocol.vercel.app",
          vercelBranchUrl: "user@evil.example.com",
          requestOrigin: "https://evil.example.com",
        }),
      ).toBeNull();

      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "preview",
          vercelUrl: "invalid host[",
          requestOrigin: null,
        }),
      ).toBeNull();
    });
  });

  describe("branch (c): non-production environments", () => {
    it("uses the request origin header with trailing slashes stripped", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "development",
          requestOrigin: "http://127.0.0.1:3000/",
        }),
      ).toBe("http://127.0.0.1:3000");

      expect(
        resolveAuthBaseUrl({
          nodeEnv: "development",
          vercelEnv: "development",
          requestOrigin: "http://localhost:3100",
        }),
      ).toBe("http://localhost:3100");
    });

    it("falls back to http://localhost:3000 when origin header is absent or blank", () => {
      expect(resolveAuthBaseUrl({ nodeEnv: "development", requestOrigin: null })).toBe(
        "http://localhost:3000",
      );
      expect(resolveAuthBaseUrl({ nodeEnv: "test", requestOrigin: "   " })).toBe(
        "http://localhost:3000",
      );
    });
  });

  describe("branch (d): production fail-closed", () => {
    it("returns null when VERCEL_ENV=production even with matching origin and Vercel host vars", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          vercelEnv: "production",
          vercelUrl: VERCEL_URL,
          vercelBranchUrl: VERCEL_BRANCH_URL,
          requestOrigin: `https://${VERCEL_URL}`,
        }),
      ).toBeNull();
    });

    it("never takes branch (b) or (c) when VERCEL_ENV=production even if NODE_ENV is not production", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "development",
          vercelEnv: "production",
          vercelUrl: VERCEL_URL,
          vercelBranchUrl: VERCEL_BRANCH_URL,
          requestOrigin: `https://${VERCEL_BRANCH_URL}`,
        }),
      ).toBeNull();
    });

    it("returns null in non-Vercel production without NEXT_PUBLIC_SITE_URL", () => {
      expect(
        resolveAuthBaseUrl({
          nodeEnv: "production",
          requestOrigin: "https://foodbiz.example.com",
        }),
      ).toBeNull();
    });
  });
});
