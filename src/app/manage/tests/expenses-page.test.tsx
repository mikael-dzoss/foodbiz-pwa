import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ExpensesPage from "../(authenticated)/expenses/page";
import NewExpensePage from "../(authenticated)/expenses/new/page";
import * as auth from "@/lib/auth";

afterEach(() => {
  vi.clearAllMocks();
});

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/request-time", () => ({
  getRequestNow: vi.fn(async () => new Date()),
}));

vi.mock("@/lib/auth", () => ({
  requireManagerSession: vi.fn(async () => ({
    user: {
      id: "00000000-0000-4000-8000-000000000002",
      email: "manager@test.com",
      name: "Manager",
      role: "manager",
      businessId: "11111111-1111-4111-8111-111111111111",
    },
    business: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Test Shop",
      slug: "test-shop",
      currency: "EUR",
    },
    expiresAt: "2099-01-01T00:00:00.000Z",
  })),
}));

vi.mock("@/features/expenses/expense-data", () => ({
  listExpenses: vi.fn(async () => [
    {
      id: "55555555-5555-4555-8555-555555555501",
      businessId: "11111111-1111-4111-8111-111111111111",
      amount: 14550,
      date: new Date().toISOString().slice(0, 10),
      description: "Organic stoneground flour",
      tags: ["Ingredients"],
      createdAt: new Date().toISOString(),
    },
  ]),
}));

vi.mock("@/features/expenses/expense-actions", () => ({
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  deleteExpenseAction: vi.fn(),
}));

describe("ExpensesPage (Screen M-50)", () => {
  it("authenticates manager session and renders expenses manager", async () => {
    const page = await ExpensesPage({});
    render(page);

    expect(auth.requireManagerSession).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Expenses" })).toBeDefined();
    expect(screen.getByText("Organic stoneground flour")).toBeDefined();
  });

  it("opens add expense sheet when action=new query param is passed", async () => {
    const page = await ExpensesPage({
      searchParams: Promise.resolve({ action: "new" }),
    });
    render(page);

    expect(screen.getByTestId("expense-sheet")).toBeDefined();
    expect(screen.getByTestId("expense-sheet-title").textContent).toBe("New expense");
  });
});

describe("NewExpensePage", () => {
  it("redirects to /manage/expenses?action=new", () => {
    NewExpensePage();
    expect(mockRedirect).toHaveBeenCalledWith("/manage/expenses?action=new");
  });
});
