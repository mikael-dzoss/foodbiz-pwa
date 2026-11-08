import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExpenseManager } from "../components/expense-manager";
import type { Expense } from "@/domain";
import * as actions from "../expense-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockExpenses: Expense[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    businessId: "biz-1",
    amount: 12450, // €124.50
    date: new Date().toISOString().slice(0, 10), // today (this month)
    description: "Organic vegetables",
    tags: ["Ingredients"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    businessId: "biz-1",
    amount: 7800, // €78.00
    date: new Date().toISOString().slice(0, 10), // today (this month)
    description: "Van fuel refill",
    tags: ["Transport"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "55555555-5555-4555-8555-555555555503",
    businessId: "biz-1",
    amount: 21500, // €215.00
    date: "2026-08-15",
    description: "Bakery boxes and cups",
    tags: ["Supplies"],
    createdAt: "2026-08-15T10:00:00.000Z",
  },
];

describe("ExpenseManager Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders screen header, KPI card, filters, and grouped monthly list", () => {
    render(<ExpenseManager initialExpenses={mockExpenses} />);

    expect(screen.getByRole("heading", { name: "Expenses" })).toBeDefined();
    expect(screen.getByTestId("add-expense-button")).toBeDefined();
    expect(screen.getByTestId("expenses-kpi-card")).toBeDefined();

    // Period buttons
    expect(screen.getByTestId("period-filter-this-month")).toBeDefined();
    expect(screen.getByTestId("period-filter-last-month")).toBeDefined();
    expect(screen.getByTestId("period-filter-all")).toBeDefined();

    // Tag pills
    expect(screen.getByTestId("tag-filter-all")).toBeDefined();
    expect(screen.getByTestId("tag-filter-Ingredients")).toBeDefined();
    expect(screen.getByTestId("tag-filter-Transport")).toBeDefined();

    // Default "this-month" filter displays the two items from this month
    expect(screen.getByText("Organic vegetables")).toBeDefined();
    expect(screen.getByText("Van fuel refill")).toBeDefined();
    // Item from August is not in "this-month"
    expect(screen.queryByText("Bakery boxes and cups")).toBeNull();
  });

  it("filters expenses when selecting 'All time'", () => {
    render(<ExpenseManager initialExpenses={mockExpenses} />);

    fireEvent.click(screen.getByTestId("period-filter-all"));

    // Now August item is visible
    expect(screen.getByText("Bakery boxes and cups")).toBeDefined();
    expect(screen.getByText("Organic vegetables")).toBeDefined();
    expect(screen.getByText("Van fuel refill")).toBeDefined();
  });

  it("filters expenses by tag", () => {
    render(<ExpenseManager initialExpenses={mockExpenses} />);

    // Click Transport filter
    fireEvent.click(screen.getByTestId("tag-filter-Transport"));

    expect(screen.getByText("Van fuel refill")).toBeDefined();
    expect(screen.queryByText("Organic vegetables")).toBeNull();
  });

  it("renders empty state with quick add when no expenses match filter", () => {
    render(<ExpenseManager initialExpenses={mockExpenses} />);

    // Equipment tag has 0 items
    fireEvent.click(screen.getByTestId("tag-filter-Equipment"));

    const emptyState = screen.getByTestId("expenses-empty-state");
    expect(emptyState).toBeDefined();
    expect(screen.getByText("No expenses found")).toBeDefined();

    // Clicking "Add expense" from empty state opens the sheet
    const addBtn = screen.getByTestId("empty-state-action");
    fireEvent.click(addBtn);

    expect(screen.getByTestId("expense-sheet")).toBeDefined();
    expect(screen.getByTestId("expense-sheet-title").textContent).toBe("New expense");
  });

  it("opens create expense sheet on '+ Add expense' click", () => {
    render(<ExpenseManager initialExpenses={mockExpenses} />);

    fireEvent.click(screen.getByTestId("add-expense-button"));

    expect(screen.getByTestId("expense-sheet")).toBeDefined();
    expect(screen.getByTestId("expense-sheet-title").textContent).toBe("New expense");
    expect(screen.getByTestId("expense-amount-input")).toBeDefined();
    expect(screen.getByTestId("expense-description-input")).toBeDefined();
    expect(screen.getByTestId("expense-date-input")).toBeDefined();
  });

  it("opens edit expense sheet when clicking an expense row", () => {
    render(<ExpenseManager initialExpenses={mockExpenses} />);

    fireEvent.click(screen.getByTestId("expense-row-55555555-5555-4555-8555-555555555501"));

    expect(screen.getByTestId("expense-sheet")).toBeDefined();
    expect(screen.getByTestId("expense-sheet-title").textContent).toBe("Edit expense");

    const descInput = screen.getByTestId("expense-description-input") as HTMLInputElement;
    expect(descInput.value).toBe("Organic vegetables");

    const amountInput = screen.getByTestId("expense-amount-input") as HTMLInputElement;
    expect(amountInput.value).toBe("124.50");

    // Delete trigger is visible in edit mode
    expect(screen.getByTestId("expense-delete-trigger")).toBeDefined();
  });

  it("successfully creates a new expense via createExpenseAction", async () => {
    const createdExpense: Expense = {
      id: "new-exp-1",
      businessId: "biz-1",
      amount: 4500,
      date: new Date().toISOString().slice(0, 10),
      description: "Butter blocks",
      tags: ["Ingredients"],
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(actions, "createExpenseAction").mockResolvedValue({
      success: true,
      data: createdExpense,
    });

    render(<ExpenseManager initialExpenses={mockExpenses} />);

    fireEvent.click(screen.getByTestId("add-expense-button"));

    const amountInput = screen.getByTestId("expense-amount-input");
    fireEvent.change(amountInput, { target: { value: "45.00" } });

    const descInput = screen.getByTestId("expense-description-input");
    fireEvent.change(descInput, { target: { value: "Butter blocks" } });

    const submitBtn = screen.getByTestId("expense-submit-button");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.createExpenseAction).toHaveBeenCalledWith({
        amount: 4500,
        date: expect.any(String),
        description: "Butter blocks",
        tags: ["Ingredients"],
      });
    });

    // Added to the list
    await waitFor(() => {
      expect(screen.getByText("Butter blocks")).toBeDefined();
    });
  });

  it("successfully updates an expense via updateExpenseAction", async () => {
    const updatedExpense: Expense = {
      ...mockExpenses[0],
      description: "Fresh Organic Vegetables (local)",
      amount: 13000,
    };

    vi.spyOn(actions, "updateExpenseAction").mockResolvedValue({
      success: true,
      data: updatedExpense,
    });

    render(<ExpenseManager initialExpenses={mockExpenses} />);

    fireEvent.click(screen.getByTestId("expense-row-55555555-5555-4555-8555-555555555501"));

    const descInput = screen.getByTestId("expense-description-input");
    fireEvent.change(descInput, { target: { value: "Fresh Organic Vegetables (local)" } });

    const amountInput = screen.getByTestId("expense-amount-input");
    fireEvent.change(amountInput, { target: { value: "130.00" } });

    fireEvent.click(screen.getByTestId("expense-submit-button"));

    await waitFor(() => {
      expect(actions.updateExpenseAction).toHaveBeenCalledWith(mockExpenses[0].id, {
        amount: 13000,
        date: expect.any(String),
        description: "Fresh Organic Vegetables (local)",
        tags: ["Ingredients"],
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Fresh Organic Vegetables (local)")).toBeDefined();
    });
  });

  it("deletes an expense with confirmation dialog via deleteExpenseAction", async () => {
    vi.spyOn(actions, "deleteExpenseAction").mockResolvedValue({
      success: true,
      data: undefined,
    });

    render(<ExpenseManager initialExpenses={mockExpenses} />);

    fireEvent.click(screen.getByTestId("expense-row-55555555-5555-4555-8555-555555555501"));

    // Click delete trigger
    fireEvent.click(screen.getByTestId("expense-delete-trigger"));

    // Confirm dialog opens
    expect(screen.getByTestId("expense-delete-dialog")).toBeDefined();
    expect(screen.getByText(/Are you sure you want to delete this expense/)).toBeDefined();

    // Confirm delete
    fireEvent.click(screen.getByTestId("expense-delete-confirm-button"));

    await waitFor(() => {
      expect(actions.deleteExpenseAction).toHaveBeenCalledWith(mockExpenses[0].id);
    });

    // Row is removed from display
    await waitFor(() => {
      expect(screen.queryByTestId("expense-row-55555555-5555-4555-8555-555555555501")).toBeNull();
    });
  });
});
