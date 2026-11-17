import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { APP_METADATA } from "@/config/app";
import { dashboardPeriodPresetSchema } from "@/domain";
import { DashboardView } from "@/features/dashboard";
import { getDashboardData } from "@/features/dashboard/dashboard-data";

export const metadata: Metadata = {
  title: `Dashboard | ${APP_METADATA.name}`,
  description: "One-screen overview of business health, KPIs and operational triage.",
};

interface ManageDashboardPageProps {
  searchParams?: Promise<{ period?: string }>;
}

export default async function ManageDashboardPage({ searchParams }: ManageDashboardPageProps = {}) {
  await requireManagerSession();
  const params = searchParams ? await searchParams : undefined;

  const parsedPreset = dashboardPeriodPresetSchema.safeParse(params?.period);
  const periodPreset = parsedPreset.success ? parsedPreset.data : "today";

  const initialData = await getDashboardData(periodPreset);

  return (
    <div className="mx-auto max-w-xl">
      <DashboardView initialData={initialData} />
    </div>
  );
}
