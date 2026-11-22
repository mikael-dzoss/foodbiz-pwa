import "server-only";

import { requireAuthenticatedAction } from "@/features/auth";
import { getRepositories } from "@/lib/repositories";
import type { ExpenseFilter } from "@/domain/repositories";

/** Expenses of the signed-in manager's business. Read errors throw to the route error boundary. */
export async function listExpenses(filter?: ExpenseFilter) {
  const { businessId } = await requireAuthenticatedAction();
  return getRepositories().expenses.list(businessId, filter);
}
