import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isDevOrTestEnvironment,
  isEmailInAllowedManagerList,
  parseAllowedManagerEmails,
} from "../access";

describe("lib: auth access", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("parseAllowedManagerEmails", () => {
    it("returns empty array when raw value is null, undefined, or empty string", () => {
      expect(parseAllowedManagerEmails(null)).toEqual([]);
      expect(parseAllowedManagerEmails(undefined)).toEqual([]);
      expect(parseAllowedManagerEmails("")).toEqual([]);
      expect(parseAllowedManagerEmails("   ")).toEqual([]);
    });

    it("parses comma-separated emails, trims whitespace, and lowercases values", () => {
      const raw = " Dev@Example.COM , QA@lapetiteboulangerie.fr , Marie@FoodBiz.APP ";
      const result = parseAllowedManagerEmails(raw);
      expect(result).toEqual(["dev@example.com", "qa@lapetiteboulangerie.fr", "marie@foodbiz.app"]);
    });

    it("filters out empty or whitespace-only elements", () => {
      const raw = " , , dev@example.com ,,   ,  ";
      const result = parseAllowedManagerEmails(raw);
      expect(result).toEqual(["dev@example.com"]);
    });
  });

  describe("isDevOrTestEnvironment", () => {
    it("returns true when both NODE_ENV and APP_ENV are development", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "development", appEnv: "development" })).toBe(true);
    });

    it("returns true when both NODE_ENV and APP_ENV are test", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "test", appEnv: "test" })).toBe(true);
    });

    it("returns true when NODE_ENV is development and APP_ENV is test (or vice versa)", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "development", appEnv: "test" })).toBe(true);
      expect(isDevOrTestEnvironment({ nodeEnv: "test", appEnv: "development" })).toBe(true);
    });

    it("defaults appEnv to nodeEnv when appEnv is unset", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "development" })).toBe(true);
      expect(isDevOrTestEnvironment({ nodeEnv: "test" })).toBe(true);
    });

    it("returns false unconditionally when NODE_ENV is production", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "production", appEnv: "development" })).toBe(false);
      expect(isDevOrTestEnvironment({ nodeEnv: "production" })).toBe(false);
    });

    it("returns false unconditionally when APP_ENV is production", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "development", appEnv: "production" })).toBe(false);
      expect(isDevOrTestEnvironment({ nodeEnv: "test", appEnv: "production" })).toBe(false);
    });

    it("returns false when APP_ENV is staging", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "development", appEnv: "staging" })).toBe(false);
      expect(isDevOrTestEnvironment({ nodeEnv: "test", appEnv: "staging" })).toBe(false);
    });

    it("returns false for unknown environments", () => {
      expect(isDevOrTestEnvironment({ nodeEnv: "preview", appEnv: "preview" })).toBe(false);
    });

    it("reads from process.env when options are omitted", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "development");
      expect(isDevOrTestEnvironment()).toBe(true);

      vi.stubEnv("NODE_ENV", "production");
      expect(isDevOrTestEnvironment()).toBe(false);
    });
  });

  describe("isEmailInAllowedManagerList", () => {
    it("returns false when email is null, undefined, or empty", () => {
      expect(
        isEmailInAllowedManagerList(null, {
          allowedEmailsRaw: "dev@example.com",
          nodeEnv: "development",
        }),
      ).toBe(false);
      expect(
        isEmailInAllowedManagerList(undefined, {
          allowedEmailsRaw: "dev@example.com",
          nodeEnv: "development",
        }),
      ).toBe(false);
      expect(
        isEmailInAllowedManagerList("", {
          allowedEmailsRaw: "dev@example.com",
          nodeEnv: "development",
        }),
      ).toBe(false);
      expect(
        isEmailInAllowedManagerList("   ", {
          allowedEmailsRaw: "dev@example.com",
          nodeEnv: "development",
        }),
      ).toBe(false);
    });

    it("returns true when email matches case-insensitively in development or test", () => {
      const allowed = "dev@example.com,qa@lapetiteboulangerie.fr";
      expect(
        isEmailInAllowedManagerList("DEV@example.COM", {
          allowedEmailsRaw: allowed,
          nodeEnv: "development",
          appEnv: "development",
        }),
      ).toBe(true);

      expect(
        isEmailInAllowedManagerList("  QA@lapetiteboulangerie.fr  ", {
          allowedEmailsRaw: allowed,
          nodeEnv: "test",
          appEnv: "test",
        }),
      ).toBe(true);
    });

    it("returns false when email is not in the list", () => {
      expect(
        isEmailInAllowedManagerList("intruder@example.com", {
          allowedEmailsRaw: "dev@example.com",
          nodeEnv: "development",
          appEnv: "development",
        }),
      ).toBe(false);
    });

    it("proves ALLOWED_MANAGER_EMAILS is unconditionally ignored when NODE_ENV is production", () => {
      const allowed = "dev@example.com,ceo@lapetiteboulangerie.fr";
      expect(
        isEmailInAllowedManagerList("dev@example.com", {
          allowedEmailsRaw: allowed,
          nodeEnv: "production",
          appEnv: "development",
        }),
      ).toBe(false);
    });

    it("proves ALLOWED_MANAGER_EMAILS is unconditionally ignored when APP_ENV is production", () => {
      const allowed = "dev@example.com,ceo@lapetiteboulangerie.fr";
      expect(
        isEmailInAllowedManagerList("dev@example.com", {
          allowedEmailsRaw: allowed,
          nodeEnv: "development",
          appEnv: "production",
        }),
      ).toBe(false);
    });

    it("proves ALLOWED_MANAGER_EMAILS is unconditionally ignored when APP_ENV is staging", () => {
      const allowed = "dev@example.com";
      expect(
        isEmailInAllowedManagerList("dev@example.com", {
          allowedEmailsRaw: allowed,
          nodeEnv: "development",
          appEnv: "staging",
        }),
      ).toBe(false);
    });

    it("falls back to reading from getServerEnv() when allowedEmailsRaw option is omitted", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ENV", "development");
      vi.stubEnv("ALLOWED_MANAGER_EMAILS", "whitelist@example.com");

      expect(isEmailInAllowedManagerList("whitelist@example.com")).toBe(true);
      expect(isEmailInAllowedManagerList("other@example.com")).toBe(false);
    });
  });

  describe(".env.example documentation check", () => {
    it("documents ALLOWED_MANAGER_EMAILS and does not prefix it with NEXT_PUBLIC_", () => {
      const envExamplePath = path.resolve(process.cwd(), ".env.example");
      const content = fs.readFileSync(envExamplePath, "utf-8");

      expect(content).toContain("ALLOWED_MANAGER_EMAILS=");
      expect(content).not.toContain("NEXT_PUBLIC_ALLOWED_MANAGER_EMAILS");
      expect(content).toMatch(/development and test|development or test/i);
      expect(content).toMatch(/ignored in production/i);
    });
  });
});
