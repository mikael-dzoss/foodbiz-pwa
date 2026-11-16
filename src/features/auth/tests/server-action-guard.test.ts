import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_FORBIDDEN_CODE, OwnerRequiredError, type ManagerSession } from "@/domain/auth";
import {
  forbiddenResult,
  isForbiddenError,
  requireAuthenticatedAction,
  requireOwnerAction,
} from "../server-action-guard";

const mockRequireManagerSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  requireManagerSession: () => mockRequireManagerSession(),
}));

function sessionWithRole(role: "owner" | "manager" | "staff"): ManagerSession {
  return {
    user: {
      id: "00000000-0000-4000-8000-000000000002",
      email: "member@example.com",
      name: "Member",
      role,
      businessId: "11111111-1111-4111-8111-111111111111",
    },
    business: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Biz",
      slug: "biz",
      currency: "EUR",
    },
    expiresAt: null,
  };
}

describe("server action guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requireAuthenticatedAction returns the session and its business id for every role", async () => {
    for (const role of ["owner", "manager", "staff"] as const) {
      mockRequireManagerSession.mockResolvedValueOnce(sessionWithRole(role));
      const context = await requireAuthenticatedAction();
      expect(context.businessId).toBe("11111111-1111-4111-8111-111111111111");
      expect(context.session.user.role).toBe(role);
    }
  });

  it("requireOwnerAction lets an owner through", async () => {
    mockRequireManagerSession.mockResolvedValueOnce(sessionWithRole("owner"));
    await expect(requireOwnerAction()).resolves.toMatchObject({
      businessId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it.each(["manager", "staff"] as const)("requireOwnerAction refuses a %s", async (role) => {
    mockRequireManagerSession.mockResolvedValueOnce(sessionWithRole(role));
    await expect(requireOwnerAction()).rejects.toBeInstanceOf(OwnerRequiredError);
  });

  it("requireOwnerAction propagates an unauthenticated redirect untouched", async () => {
    mockRequireManagerSession.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(requireOwnerAction()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("forbiddenResult is a typed FORBIDDEN result with fixed text", () => {
    expect(forbiddenResult()).toEqual({
      success: false,
      error: "Only an owner can do this.",
      code: ACTION_FORBIDDEN_CODE,
    });
    expect(forbiddenResult().code).toBe("FORBIDDEN");
  });

  it("isForbiddenError recognises only OwnerRequiredError", () => {
    expect(isForbiddenError(new OwnerRequiredError())).toBe(true);
    expect(isForbiddenError(new Error("nope"))).toBe(false);
    expect(isForbiddenError("OWNER_REQUIRED")).toBe(false);
  });
});
