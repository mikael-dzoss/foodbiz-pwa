import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExpenseSheet } from "../components/expense-sheet";
import type { Expense } from "@/domain";
import * as actions from "../expense-actions";

const mockExpense: Expense = {
  id: "55555555-5555-4555-8555-555555555501",
  businessId: "biz-1",
  amount: 14550,
  date: "2026-10-14",
  description: "Organic flour sacks",
  tags: ["Ingredients", "Supplies"],
  createdAt: "2026-10-14T08:00:00.000Z",
};

describe("ExpenseSheet Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders create mode when no expense is provided", () => {
    const onOpenChange = vi.fn();
    render(<ExpenseSheet open={true} onOpenChange={onOpenChange} />);

    expect(screen.getByTestId("expense-sheet")).toBeDefined();
    expect(screen.getByTestId("expense-sheet-title").textContent).toBe("New expense");
    expect(screen.getByTestId("expense-amount-input")).toBeDefined();
    expect(screen.queryByTestId("expense-delete-trigger")).toBeNull();
  });

  it("handles quick amount increment buttons and comma decimal input", () => {
    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} />);

    const amountInput = screen.getByTestId("expense-amount-input") as HTMLInputElement;

    // Click +€10
    fireEvent.click(screen.getByText("+€10"));
    expect(amountInput.value).toBe("10.00");

    // Click +€50
    fireEvent.click(screen.getByText("+€50"));
    expect(amountInput.value).toBe("60.00");

    // Click +€100
    fireEvent.click(screen.getByText("+€100"));
    expect(amountInput.value).toBe("160.00");

    // Manual typing with comma
    fireEvent.change(amountInput, { target: { value: "25,50" } });
    expect(amountInput.value).toBe("25,50");
  });

  it("allows toggling tags when multiple tags are selected", () => {
    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} expense={mockExpense} />);

    // Initial tags are Ingredients and Supplies
    const suppliesTag = screen.getByTestId("expense-tag-Supplies");
    expect(suppliesTag.getAttribute("aria-pressed")).toBe("true");

    // Toggle off Supplies (leaves Ingredients)
    fireEvent.click(suppliesTag);
    expect(suppliesTag.getAttribute("aria-pressed")).toBe("false");

    // Toggle on Transport
    const transportTag = screen.getByTestId("expense-tag-Transport");
    fireEvent.click(transportTag);
    expect(transportTag.getAttribute("aria-pressed")).toBe("true");

    // Toggling off when only 1 tag remains is prevented
    const ingredientsTag = screen.getByTestId("expense-tag-Ingredients");
    fireEvent.click(ingredientsTag);
    // Transport is on, so Ingredients can be toggled off
    expect(ingredientsTag.getAttribute("aria-pressed")).toBe("false");

    // Now only Transport is on, clicking Transport should NOT deselect it
    fireEvent.click(transportTag);
    expect(transportTag.getAttribute("aria-pressed")).toBe("true");
  });

  it("validates empty or invalid fields on submit", async () => {
    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} />);

    // Clear description
    const descInput = screen.getByTestId("expense-description-input");
    fireEvent.change(descInput, { target: { value: "" } });

    // Submit with zero amount
    fireEvent.click(screen.getByTestId("expense-submit-button"));

    expect(screen.getByText("Amount must be greater than 0")).toBeDefined();

    // Set valid amount
    const amountInput = screen.getByTestId("expense-amount-input");
    fireEvent.change(amountInput, { target: { value: "15.00" } });

    fireEvent.click(screen.getByTestId("expense-submit-button"));
    expect(screen.getByText("Description is required")).toBeDefined();

    // Set description
    fireEvent.change(descInput, { target: { value: "Delivery" } });

    // Clear date
    const dateInput = screen.getByTestId("expense-date-input");
    fireEvent.change(dateInput, { target: { value: "" } });

    fireEvent.click(screen.getByTestId("expense-submit-button"));
    expect(screen.getByText("Date is required")).toBeDefined();
  });

  it("handles create action API failure and field errors", async () => {
    vi.spyOn(actions, "createExpenseAction").mockResolvedValue({
      ok: false,
      code: "INTERNAL",
      message: "Validation failed on server",
      fieldErrors: {
        description: ["Server rejected description"],
      },
    });

    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByTestId("expense-amount-input"), { target: { value: "20.00" } });
    fireEvent.change(screen.getByTestId("expense-description-input"), {
      target: { value: "Fuel" },
    });
    fireEvent.click(screen.getByTestId("expense-submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("expense-error-message")).toBeDefined();
      expect(screen.getByText("Validation failed on server")).toBeDefined();
      expect(screen.getByText("Server rejected description")).toBeDefined();
    });
  });

  it("handles update action API failure", async () => {
    vi.spyOn(actions, "updateExpenseAction").mockResolvedValue({
      ok: false,
      code: "INTERNAL",
      message: "Update rejected by database",
    });

    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} expense={mockExpense} />);

    fireEvent.click(screen.getByTestId("expense-submit-button"));

    await waitFor(() => {
      expect(screen.getByTestId("expense-error-message")).toBeDefined();
      expect(screen.getByText("Update rejected by database")).toBeDefined();
    });
  });

  it("handles unexpected thrown exceptions on submit", async () => {
    vi.spyOn(actions, "createExpenseAction").mockRejectedValue(new Error("Network disconnect"));

    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByTestId("expense-amount-input"), { target: { value: "10.00" } });
    fireEvent.change(screen.getByTestId("expense-description-input"), {
      target: { value: "Item" },
    });
    fireEvent.click(screen.getByTestId("expense-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("An unexpected error occurred. Please try again.")).toBeDefined();
    });
  });

  it("handles delete confirmation and delete errors", async () => {
    vi.spyOn(actions, "deleteExpenseAction").mockResolvedValue({
      ok: false,
      code: "INTERNAL",
      message: "Cannot delete expense",
    });

    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} expense={mockExpense} />);

    // Click delete trigger
    fireEvent.click(screen.getByTestId("expense-delete-trigger"));
    expect(screen.getByTestId("expense-delete-dialog")).toBeDefined();

    // Confirm delete
    fireEvent.click(screen.getByTestId("expense-delete-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Cannot delete expense")).toBeDefined();
    });
  });

  it("handles unexpected thrown exceptions on delete", async () => {
    vi.spyOn(actions, "deleteExpenseAction").mockRejectedValue(new Error("Network boom"));

    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} expense={mockExpense} />);

    fireEvent.click(screen.getByTestId("expense-delete-trigger"));
    fireEvent.click(screen.getByTestId("expense-delete-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Failed to delete expense.")).toBeDefined();
    });
  });

  it("closes when Cancel button is clicked", () => {
    const onOpenChange = vi.fn();
    render(<ExpenseSheet open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables deleting with an explanation when only an owner may delete", () => {
    render(
      <ExpenseSheet
        open={true}
        onOpenChange={vi.fn()}
        expense={mockExpense}
        deleteDisabledReason="Only the shop owner can change this."
      />,
    );

    expect((screen.getByTestId("expense-delete-trigger") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("expense-delete-owner-only").textContent).toBe(
      "Only the shop owner can change this.",
    );
  });

  it("keeps deleting enabled without an explanation", () => {
    render(<ExpenseSheet open={true} onOpenChange={vi.fn()} expense={mockExpense} />);

    expect((screen.getByTestId("expense-delete-trigger") as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(screen.queryByTestId("expense-delete-owner-only")).toBeNull();
  });
});
