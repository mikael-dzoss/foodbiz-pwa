import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { APP_METADATA } from "@/config/app";
import { buildDashboardData, dashboardPeriodPresetSchema } from "@/domain";
import { getDashboardDataAction, DashboardView } from "@/features/dashboard";

export const metadata: Metadata = {
  title: `Dashboard | ${APP_METADATA.name}`,
  description: "One-screen overview of business health, KPIs and operational triage.",
};

export const instant = false;

interface ManageDashboardPageProps {
  searchParams?: Promise<{ period?: string }>;
}

export default async function ManageDashboardPage({ searchParams }: ManageDashboardPageProps = {}) {
  await requireManagerSession();
  const params = searchParams ? await searchParams : undefined;

  const parsedPreset = dashboardPeriodPresetSchema.safeParse(params?.period);
  const periodPreset = parsedPreset.success ? parsedPreset.data : "today";

  const res = await getDashboardDataAction({ periodPreset });

  const initialData = res.success
    ? res.data
    : buildDashboardData({
        orders: [],
        expenses: [],
        products: [],
        periodPreset,
      });

  return (
    <div className="mx-auto max-w-xl">
      <DashboardView initialData={initialData} />
    </div>
  );
}
