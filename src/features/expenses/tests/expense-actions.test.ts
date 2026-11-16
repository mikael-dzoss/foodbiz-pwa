import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Expense } from "@/domain";
import {
  listExpensesAction,
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from "../expense-actions";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

const testBusinessId = "11111111-1111-4111-8111-111111111111";
const validExpenseId = "55555555-5555-4555-8555-555555555501";

let mockExpenses: Expense[] = [];

const mockExpenseRepo = {
  list: vi.fn(
    async (_bId: string, filter?: { tag?: string; fromDate?: string; toDate?: string }) => {
      let result = [...mockExpenses];
      if (filter?.tag) {
        result = result.filter((e) => e.tags.includes(filter.tag!));
      }
      return result;
    },
  ),
  findById: vi.fn(
    async (_bId: string, id: string) => mockExpenses.find((e) => e.id === id) ?? null,
  ),
  create: vi.fn(
    async (
      bId: string,
      input: { amount: number; date: string; description: string; tags?: string[] },
    ) => {
      const e: Expense = {
        id: "55555555-5555-4555-8555-555555555599",
        businessId: bId,
        amount: input.amount,
        date: input.date,
        description: input.description,
        tags: input.tags ? [...input.tags] : [],
        createdAt: new Date().toISOString(),
      };
      mockExpenses.push(e);
      return structuredClone(e);
    },
  ),
  update: vi.fn(async (_bId: string, id: string, input: Partial<Expense>) => {
    const idx = mockExpenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("Expense not found");
    const updated = { ...mockExpenses[idx], ...input };
    mockExpenses[idx] = updated;
    return structuredClone(updated);
  }),
  delete: vi.fn(async (_bId: string, id: string) => {
    const idx = mockExpenses.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("Expense not found");
    mockExpenses.splice(idx, 1);
  }),
};

vi.mock("@/lib/repositories", () => ({
  getRepositories: () => ({
    expenses: mockExpenseRepo,
  }),
}));

const mockRequireAuthenticatedAction = vi.fn(async () => ({
  session: {
    user: { id: "user-1", email: "manager@test.com" },
    business: { id: testBusinessId, name: "Test Bakery", slug: "test-bakery" },
    role: "manager" as const,
  },
  businessId: testBusinessId,
}));

const authState = vi.hoisted(() => ({ role: "owner" as "owner" | "manager" | "staff" }));

vi.mock("@/features/auth", async () => {
  const domainAuth = await vi.importActual<typeof import("@/domain/auth")>("@/domain/auth");
  return {
    requireAuthenticatedAction: () => mockRequireAuthenticatedAction(),
    requireOwnerAction: async () => {
      const context = await mockRequireAuthenticatedAction();
      if (authState.role !== "owner") throw new domainAuth.OwnerRequiredError();
      return context;
    },
    forbiddenResult: () => ({
      success: false as const,
      error: "Only an owner can do this.",
      code: domainAuth.ACTION_FORBIDDEN_CODE,
    }),
    isForbiddenError: (err: unknown) => err instanceof domainAuth.OwnerRequiredError,
  };
});

describe("Expense Server Actions", () => {
  beforeEach(() => {
    authState.role = "owner";
    vi.clearAllMocks();

    mockExpenses = [
      {
        id: validExpenseId,
        businessId: testBusinessId,
        amount: 14550,
        date: "2026-10-14",
        description: "Organic flour sacks",
        tags: ["Ingredients"],
        createdAt: "2026-10-14T08:00:00.000Z",
      },
      {
        id: "55555555-5555-4555-8555-555555555502",
        businessId: testBusinessId,
        amount: 8000,
        date: "2026-10-12",
        description: "Van petrol",
        tags: ["Transport"],
        createdAt: "2026-10-12T10:00:00.000Z",
      },
    ];
  });

  describe("listExpensesAction", () => {
    it("returns list of expenses successfully", async () => {
      const res = await listExpensesAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toHaveLength(2);
        expect(res.data[0].id).toBe(validExpenseId);
      }
    });

    it("passes tag filter to repository", async () => {
      const res = await listExpensesAction({ tag: "Transport" });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].description).toBe("Van petrol");
      }
    });

    it("returns error if auth fails", async () => {
      mockRequireAuthenticatedAction.mockRejectedValueOnce(new Error("Unauthorized"));
      const res = await listExpensesAction();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Unauthorized");
      }
    });
  });

  describe("createExpenseAction", () => {
    it("creates a new expense and revalidates relevant paths", async () => {
      const input = {
        amount: 25000,
        date: "2026-10-15",
        description: "High-grade espresso beans",
        tags: ["Ingredients"],
      };

      const res = await createExpenseAction(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.amount).toBe(25000);
        expect(res.data.description).toBe("High-grade espresso beans");
        expect(res.data.tags).toEqual(["Ingredients"]);
      }

      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/expenses");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects invalid input with field errors", async () => {
      const invalid = {
        amount: -100, // Negative amount
        date: "invalid-date",
        description: "",
        tags: [],
      };

      const res = await createExpenseAction(invalid);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Invalid expense data");
        expect(res.fieldErrors).toBeDefined();
        expect(res.fieldErrors?.amount).toBeDefined();
        expect(res.fieldErrors?.description).toBeDefined();
        expect(res.fieldErrors?.date).toBeDefined();
        expect(res.fieldErrors?.tags).toBeDefined();
      }
      expect(mockExpenseRepo.create).not.toHaveBeenCalled();
    });

    it("handles repository error gracefully", async () => {
      mockExpenseRepo.create.mockRejectedValueOnce(new Error("Database write error"));
      const res = await createExpenseAction({
        amount: 5000,
        date: "2026-10-15",
        description: "Boxes",
        tags: ["Supplies"],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Database write error");
      }
    });
  });

  describe("updateExpenseAction", () => {
    it("updates an existing expense successfully", async () => {
      const res = await updateExpenseAction(validExpenseId, {
        description: "Organic stoneground flour",
        amount: 15500,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.description).toBe("Organic stoneground flour");
        expect(res.data.amount).toBe(15500);
      }
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/expenses");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects invalid UUID id", async () => {
      const res = await updateExpenseAction("invalid-id", {
        description: "Updated description",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Invalid expense ID");
      }
      expect(mockExpenseRepo.update).not.toHaveBeenCalled();
    });

    it("rejects non-positive amount on update", async () => {
      const res = await updateExpenseAction(validExpenseId, {
        amount: 0,
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Invalid expense update data");
        expect(res.fieldErrors?.amount).toBeDefined();
      }
    });

    it("handles not found error from repository", async () => {
      const missingId = "00000000-0000-4000-8000-000000000000";
      const res = await updateExpenseAction(missingId, {
        description: "New title",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Expense not found");
      }
    });
  });

  describe("deleteExpenseAction", () => {
    it("deletes an existing expense and revalidates paths", async () => {
      const res = await deleteExpenseAction(validExpenseId);
      expect(res.success).toBe(true);
      expect(mockExpenses).toHaveLength(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/expenses");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/manage");
    });

    it("rejects invalid UUID id on delete", async () => {
      const res = await deleteExpenseAction("not-a-uuid");
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Invalid expense ID");
      }
      expect(mockExpenseRepo.delete).not.toHaveBeenCalled();
    });

    it("handles non-Error thrown during delete", async () => {
      mockExpenseRepo.delete.mockRejectedValueOnce("Unknown error string");
      const res = await deleteExpenseAction(validExpenseId);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to delete expense");
      }
    });

    it("handles non-Error thrown during list", async () => {
      mockExpenseRepo.list.mockRejectedValueOnce("Unknown list error");
      const res = await listExpensesAction();
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to load expenses");
      }
    });

    it("handles non-Error thrown during update", async () => {
      mockExpenseRepo.update.mockRejectedValueOnce("Unknown update error");
      const res = await updateExpenseAction(validExpenseId, { amount: 1000 });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe("Failed to update expense");
      }
    });
  });

  describe("deleteExpenseAction roles", () => {
    for (const role of ["manager", "staff"] as const) {
      it(`refuses a ${role} with the FORBIDDEN code and deletes nothing`, async () => {
        authState.role = role;
        expect(await deleteExpenseAction(validExpenseId)).toEqual({
          success: false,
          error: "Only an owner can do this.",
          code: "FORBIDDEN",
        });
        expect(mockExpenseRepo.delete).not.toHaveBeenCalled();
      });
    }

    it("turns a repository refusal (database rule) into the FORBIDDEN code", async () => {
      const { OwnerRequiredError } = await import("@/domain/auth");
      mockExpenseRepo.delete.mockRejectedValueOnce(new OwnerRequiredError());
      expect(await deleteExpenseAction(validExpenseId)).toMatchObject({
        success: false,
        code: "FORBIDDEN",
      });
    });
  });
});
