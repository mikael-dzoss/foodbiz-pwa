import type { Metadata } from "next";
import { connection } from "next/server";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { OpeningHoursOverview } from "@/features/settings/components/opening-hours-overview";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.openingHours;
  return { title: dict.title, description: dict.description };
}

export default async function OpeningHoursPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const settings = await getBusinessSettings();
  // Request-time: the overview compares against "now" (upcoming exceptions).
  await connection();

  return <OpeningHoursOverview settings={settings} locale={locale} now={new Date()} />;
}
