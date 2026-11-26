import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { RegularHoursSettings } from "@/features/settings/components/regular-hours-settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.openingHours;
  return { title: dict.regularTitle, description: dict.regularDescription };
}

export default async function RegularHoursPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const settings = await getBusinessSettings();

  return <RegularHoursSettings initial={settings.weeklyHours ?? null} locale={locale} />;
}
