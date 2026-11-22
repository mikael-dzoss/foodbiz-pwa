import { describe, expect, it } from "vitest";
import {
  ACTION_FORBIDDEN_CODE,
  MOCK_MANAGER_SESSION,
  OwnerRequiredError,
  isOwnerRole,
  authErrorCodeSchema,
  managerSessionSchema,
  managerUserSchema,
  normalizeAuthErrorCode,
  sanitizeManagerRedirectPath,
} from "../auth";

describe("domain: auth", () => {
  it("validates valid manager user schema", () => {
    const validUser = {
      id: "00000000-0000-4000-8000-000000000002",
      email: "manager@example.com",
      name: "Marie Dupont",
      role: "manager",
      businessId: "11111111-1111-4111-8111-111111111111",
    };
    const parsed = managerUserSchema.safeParse(validUser);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid role or invalid email", () => {
    const invalidRole = {
      id: "00000000-0000-4000-8000-000000000002",
      email: "not-an-email",
      name: "Marie Dupont",
      role: "superadmin",
      businessId: "11111111-1111-4111-8111-111111111111",
    };
    const parsed = managerUserSchema.safeParse(invalidRole);
    expect(parsed.success).toBe(false);
  });

  it("validates MOCK_MANAGER_SESSION fixture against schema", () => {
    const parsed = managerSessionSchema.safeParse(MOCK_MANAGER_SESSION);
    expect(parsed.success).toBe(true);
    expect(MOCK_MANAGER_SESSION.user.role).toBe("owner");
    expect(MOCK_MANAGER_SESSION.business.currency).toBe("EUR");
  });

  it("accepts null expiresAt in managerSessionSchema when token claims lack exp", () => {
    const sessionWithNullExpiry = {
      ...MOCK_MANAGER_SESSION,
      expiresAt: null,
    };
    const parsed = managerSessionSchema.safeParse(sessionWithNullExpiry);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.expiresAt).toBeNull();
  });

  describe("authErrorCodeSchema", () => {
    it("accepts valid error codes", () => {
      expect(authErrorCodeSchema.safeParse("cancelled").success).toBe(true);
      expect(authErrorCodeSchema.safeParse("denied").success).toBe(true);
      expect(authErrorCodeSchema.safeParse("no_access").success).toBe(true);
      expect(authErrorCodeSchema.safeParse("auth_failed").success).toBe(true);
    });

    it("rejects unknown error codes", () => {
      expect(authErrorCodeSchema.safeParse("unknown").success).toBe(false);
    });
  });

  describe("normalizeAuthErrorCode", () => {
    it("returns null when both error and description are empty/null", () => {
      expect(normalizeAuthErrorCode(null, null)).toBeNull();
      expect(normalizeAuthErrorCode(undefined, undefined)).toBeNull();
      expect(normalizeAuthErrorCode("", "   ")).toBeNull();
    });

    it("normalizes user cancellation variants to cancelled", () => {
      expect(normalizeAuthErrorCode("cancelled")).toBe("cancelled");
      expect(normalizeAuthErrorCode("user_cancelled")).toBe("cancelled");
      expect(normalizeAuthErrorCode("access_denied", "User cancelled consent")).toBe("cancelled");
      expect(normalizeAuthErrorCode(null, "user cancelled")).toBe("cancelled");
    });

    it("normalizes access denied variants to denied", () => {
      expect(normalizeAuthErrorCode("denied")).toBe("denied");
      expect(normalizeAuthErrorCode("access_denied")).toBe("denied");
      expect(normalizeAuthErrorCode("access_denied", "Consent not granted")).toBe("denied");
    });

    it("normalizes forbidden and unauthorized variants to no_access", () => {
      expect(normalizeAuthErrorCode("no_access")).toBe("no_access");
      expect(normalizeAuthErrorCode("forbidden")).toBe("no_access");
      expect(normalizeAuthErrorCode("unauthorized")).toBe("no_access");
    });

    it("normalizes other errors to auth_failed", () => {
      expect(normalizeAuthErrorCode("server_error")).toBe("auth_failed");
      expect(normalizeAuthErrorCode("invalid_request", "something")).toBe("auth_failed");
    });
  });

  describe("sanitizeManagerRedirectPath", () => {
    it("allows valid /manage subpaths", () => {
      expect(sanitizeManagerRedirectPath("/manage")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/orders")).toBe("/manage/orders");
      expect(sanitizeManagerRedirectPath("/manage/settings/account?tab=theme")).toBe(
        "/manage/settings/account?tab=theme",
      );
    });

    it("rejects empty, null, or non-string paths and returns fallback", () => {
      expect(sanitizeManagerRedirectPath(null)).toBe("/manage");
      expect(sanitizeManagerRedirectPath(undefined)).toBe("/manage");
      expect(sanitizeManagerRedirectPath("")).toBe("/manage");
      expect(sanitizeManagerRedirectPath(null, "/manage/dashboard")).toBe("/manage/dashboard");
    });

    it("rejects paths that do not start with /manage", () => {
      expect(sanitizeManagerRedirectPath("/storefront")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/managefoo")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/management")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manager")).toBe("/manage");
    });

    it("rejects paths containing dot-dot traversal or encoded traversal", () => {
      expect(sanitizeManagerRedirectPath("/manage/../evil")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/..")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/%2e%2e/evil")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/%2E%2E/evil")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/%2e%2e")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/%FF")).toBe("/manage");
    });

    it("prevents protocol-relative and scheme open redirects", () => {
      expect(sanitizeManagerRedirectPath("//evil.com")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/\\evil.com")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("https://evil.com/manage")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("javascript:alert(1)")).toBe("/manage");
    });

    it("prevents login redirect loops", () => {
      expect(sanitizeManagerRedirectPath("/manage/login")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/login?error=auth_failed")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/login/subpath")).toBe("/manage");
    });

    it("rejects paths containing control characters", () => {
      expect(sanitizeManagerRedirectPath("/manage/orders\n")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/orders\r\n")).toBe("/manage");
      expect(sanitizeManagerRedirectPath("/manage/\x00evil")).toBe("/manage");
    });
  });
});

describe("owner-only roles", () => {
  it("only the owner role is an owner", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("manager")).toBe(false);
    expect(isOwnerRole("staff")).toBe(false);
  });

  it("OwnerRequiredError carries the typed FORBIDDEN code", () => {
    const error = new OwnerRequiredError();
    expect(error.code).toBe(ACTION_FORBIDDEN_CODE);
    expect(error.code).toBe("FORBIDDEN");
    expect(error).toBeInstanceOf(Error);
  });

  it("the mock session is the owner of the demo business so nobody is locked out", () => {
    expect(MOCK_MANAGER_SESSION.user.role).toBe("owner");
  });
});
