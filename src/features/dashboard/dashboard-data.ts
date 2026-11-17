import "server-only";

import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import {
  type DashboardData,
  type DashboardPeriodPreset,
  attachGuestNames,
  buildDashboardData,
} from "@/domain";

/**
 * Aggregated dashboard metrics, operational triage items and activity feed for the signed-in
 * manager's business. Read errors throw to the route error boundary.
 */
export async function getDashboardData(
  periodPreset: DashboardPeriodPreset = "today",
  referenceDate?: string,
): Promise<DashboardData> {
  const { businessId } = await requireAuthenticatedAction();
  const repos = getRepositories();
  const [orders, guests, expenses, products] = await Promise.all([
    repos.orders.list(businessId),
    repos.guests.list(businessId),
    repos.expenses.list(businessId),
    repos.products.list(businessId),
  ]);

  return buildDashboardData({
    orders: attachGuestNames(orders, guests),
    expenses,
    products,
    periodPreset,
    referenceDate,
  });
}
