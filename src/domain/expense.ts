import { z } from "zod";
import { isoDateSchema, isoDateTimeSchema, moneySchema, uuidSchema } from "./common";
import { extractDate } from "./kpis";

export const STANDARD_EXPENSE_TAGS = [
  "Ingredients",
  "Transport",
  "Equipment",
  "Supplies",
  "Utilities",
] as const;

export type StandardExpenseTag = (typeof STANDARD_EXPENSE_TAGS)[number];

export const expenseTagSchema = z.string().trim().min(1);
export type ExpenseTag = z.infer<typeof expenseTagSchema>;

export const expenseSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  amount: moneySchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{4}-\d{2}-\d{2}T/, "Invalid date format"),
  description: z.string().trim().min(1),
  tags: z.array(expenseTagSchema).default([]),
  createdAt: isoDateTimeSchema,
});

export type Expense = z.infer<typeof expenseSchema>;

export const createExpenseInputSchema = z.object({
  amount: moneySchema.refine((val) => val > 0, "Amount must be greater than 0"),
  date: isoDateSchema,
  description: z.string().trim().min(1, "Description is required"),
  tags: z.array(expenseTagSchema).min(1, "At least one tag is required"),
});

export type CreateExpensePayload = z.infer<typeof createExpenseInputSchema>;

export const updateExpenseInputSchema = z.object({
  amount: moneySchema.refine((val) => val > 0, "Amount must be greater than 0").optional(),
  date: isoDateSchema.optional(),
  description: z.string().trim().min(1, "Description cannot be empty").optional(),
  tags: z.array(expenseTagSchema).min(1, "At least one tag is required").optional(),
});

export type UpdateExpensePayload = z.infer<typeof updateExpenseInputSchema>;

export type ExpensePeriodFilter = "this-month" | "last-month" | "all";

export interface ExpenseMonthGroup {
  readonly year: number;
  readonly month: number;
  readonly monthKey: string;
  readonly monthLabel: string;
  readonly totalAmount: number;
  readonly count: number;
  readonly expenses: readonly Expense[];
}

/**
 * Calculates sum of expense amounts in cents.
 */
export function calculateExpensesTotal(expenses: readonly Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Groups expenses by calendar month and calculates totals and counts.
 * Returns groups ordered from most recent month to oldest.
 * Within each group, expenses are ordered newest first.
 */
export function groupExpensesByMonth(expenses: readonly Expense[]): ExpenseMonthGroup[] {
  if (expenses.length === 0) {
    return [];
  }

  const map = new Map<string, Expense[]>();

  for (const expense of expenses) {
    const monthKey = expense.date.slice(0, 7);
    const list = map.get(monthKey);
    if (list) {
      list.push(expense);
    } else {
      map.set(monthKey, [expense]);
    }
  }

  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => {
    const items = map.get(key)!;
    const sortedItems = [...items].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const [yearStr, monthStr] = key.split("-");
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);

    const monthDate = new Date(Date.UTC(year, month - 1, 1));
    const monthLabel = monthDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    return {
      year,
      month,
      monthKey: key,
      monthLabel,
      totalAmount: calculateExpensesTotal(sortedItems),
      count: sortedItems.length,
      expenses: sortedItems,
    };
  });
}

/**
 * Filters expenses by period ("this-month", "last-month", "all") and/or tag.
 */
export function filterExpenses(
  expenses: readonly Expense[],
  options?: {
    period?: ExpensePeriodFilter;
    tag?: string;
    /** Current instant (or YYYY-MM-DD day); required with a period filter. */
    referenceDate?: Date | string;
    /** Business time zone the reference instant is read in. */
    timeZone: string;
  },
): Expense[] {
  let result = [...expenses];

  if (options?.tag && options.tag !== "all" && options.tag.trim() !== "") {
    const targetTag = options.tag.trim();
    result = result.filter((e) => e.tags.includes(targetTag));
  }

  if (options?.period && options.period !== "all") {
    if (!options.referenceDate) throw new Error("referenceDate is required with a period filter");
    const [refYear, refMonthNumber] = extractDate(options.referenceDate, options.timeZone)
      .split("-")
      .map(Number);
    const refMonth = refMonthNumber - 1;

    let targetYear = refYear;
    let targetMonth = refMonth;

    if (options.period === "last-month") {
      if (refMonth === 0) {
        targetYear = refYear - 1;
        targetMonth = 11;
      } else {
        targetMonth = refMonth - 1;
      }
    }

    const targetPrefix = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

    result = result.filter((e) => e.date.startsWith(targetPrefix));
  }

  return result;
}
