import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { dashboardPeriodPresetSchema } from "@/domain";
import { getDictionary } from "@/domain/i18n";
import { DashboardView } from "@/features/dashboard";
import { getDashboardData } from "@/features/dashboard/dashboard-data";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale());
  return {
    title: dict.dashboard.title,
    description: dict.manager.meta.dashboardDescription,
  };
}

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
