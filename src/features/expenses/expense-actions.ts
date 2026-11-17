"use server";

import { revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { defineAction } from "@/lib/actions/define-action";
import { createExpenseInputSchema, updateExpenseInputSchema, uuidSchema } from "@/domain";

function revalidateExpenses() {
  revalidatePath("/manage/expenses");
  revalidatePath("/manage");
}

/** Creates a new business expense. */
export const createExpenseAction = defineAction(
  "createExpense",
  { input: createExpenseInputSchema },
  async ({ input, businessId }) => {
    const created = await getRepositories().expenses.create(businessId, input);
    revalidateExpenses();
    return created;
  },
);

/** Updates an existing business expense: the id plus the fields to change. */
export const updateExpenseAction = defineAction(
  "updateExpense",
  { input: updateExpenseInputSchema.extend({ id: uuidSchema }) },
  async ({ input: { id, ...patch }, businessId }) => {
    const updated = await getRepositories().expenses.update(businessId, id, patch);
    revalidateExpenses();
    return updated;
  },
);

/** Deletes an expense. Hard deletes are owner-only (also enforced by the expenses delete policy). */
export const deleteExpenseAction = defineAction(
  "deleteExpense",
  { auth: "owner", input: uuidSchema },
  async ({ input: id, businessId }) => {
    await getRepositories().expenses.delete(businessId, id);
    revalidateExpenses();
  },
);
