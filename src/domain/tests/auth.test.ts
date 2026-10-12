import { describe, expect, it } from "vitest";
import { MOCK_MANAGER_SESSION, managerSessionSchema, managerUserSchema } from "../auth";

describe("domain: auth", () => {
  it("validates valid manager user schema", () => {
    const validUser = {
      id: "00000000-0000-4000-8000-000000000002",
      email: "manager@lapetiteboulangerie.fr",
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
    expect(MOCK_MANAGER_SESSION.user.role).toBe("manager");
    expect(MOCK_MANAGER_SESSION.business.currency).toBe("EUR");
  });
});
