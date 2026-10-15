"use server";

import { revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import {
  createExpenseInputSchema,
  updateExpenseInputSchema,
  uuidSchema,
  type Expense,
} from "@/domain";
import type { ExpenseFilter } from "@/domain/repositories";

export type ExpenseActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Lists expenses for the manager's business with optional tag or date range filter.
 */
export async function listExpensesAction(
  filter?: ExpenseFilter,
): Promise<ExpenseActionResult<Expense[]>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const repos = getRepositories();
    const expenses = await repos.expenses.list(businessId, filter);
    return { success: true, data: expenses };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load expenses";
    return { success: false, error: message };
  }
}

/**
 * Creates a new business expense.
 */
export async function createExpenseAction(input: unknown): Promise<ExpenseActionResult<Expense>> {
  try {
    const { businessId } = await requireAuthenticatedAction();

    const parsed = createExpenseInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid expense data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();
    const created = await repos.expenses.create(businessId, {
      amount: parsed.data.amount,
      date: parsed.data.date,
      description: parsed.data.description,
      tags: parsed.data.tags,
    });

    revalidatePath("/manage/expenses");
    revalidatePath("/manage");

    return { success: true, data: created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create expense";
    return { success: false, error: message };
  }
}

/**
 * Updates an existing business expense.
 */
export async function updateExpenseAction(
  id: string,
  input: unknown,
): Promise<ExpenseActionResult<Expense>> {
  try {
    const { businessId } = await requireAuthenticatedAction();

    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) {
      return { success: false, error: "Invalid expense ID" };
    }

    const parsed = updateExpenseInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid expense update data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();
    const updated = await repos.expenses.update(businessId, id, parsed.data);

    revalidatePath("/manage/expenses");
    revalidatePath("/manage");

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update expense";
    return { success: false, error: message };
  }
}

/**
 * Deletes an existing business expense.
 */
export async function deleteExpenseAction(id: string): Promise<ExpenseActionResult<void>> {
  try {
    const { businessId } = await requireAuthenticatedAction();

    const idParsed = uuidSchema.safeParse(id);
    if (!idParsed.success) {
      return { success: false, error: "Invalid expense ID" };
    }

    const repos = getRepositories();
    await repos.expenses.delete(businessId, id);

    revalidatePath("/manage/expenses");
    revalidatePath("/manage");

    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete expense";
    return { success: false, error: message };
  }
}
