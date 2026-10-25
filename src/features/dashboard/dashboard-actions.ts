"use server";

import { z } from "zod";
import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import {
  type DashboardData,
  attachGuestNames,
  buildDashboardData,
  dashboardPeriodPresetSchema,
} from "@/domain";

const getDashboardDataInputSchema = z.object({
  periodPreset: dashboardPeriodPresetSchema.optional().default("today"),
  referenceDate: z.string().optional(),
});

export type GetDashboardDataInput = z.infer<typeof getDashboardDataInputSchema>;

export type DashboardActionResult<T = DashboardData> =
  { success: true; data: T } | { success: false; error: string };

/**
 * Loads aggregated dashboard metrics, operational triage items, and activity feed.
 */
export async function getDashboardDataAction(
  input?: unknown,
): Promise<DashboardActionResult<DashboardData>> {
  try {
    const { businessId } = await requireAuthenticatedAction();

    const parsed = getDashboardDataInputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { success: false, error: "Invalid dashboard query parameters" };
    }

    const repos = getRepositories();
    const [orders, guests, expenses, products] = await Promise.all([
      repos.orders.list(businessId),
      repos.guests.list(businessId),
      repos.expenses.list(businessId),
      repos.products.list(businessId),
    ]);

    const data = buildDashboardData({
      orders: attachGuestNames(orders, guests),
      expenses,
      products,
      periodPreset: parsed.data.periodPreset,
      referenceDate: parsed.data.referenceDate,
    });

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load dashboard data";
    return { success: false, error: message };
  }
}
