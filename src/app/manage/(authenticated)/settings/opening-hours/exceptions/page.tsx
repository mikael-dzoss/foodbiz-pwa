import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { HoursExceptionsSettings } from "@/features/settings/components/hours-exceptions-settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.hoursExceptions;
  return { title: dict.title, description: dict.description };
}

export default async function HoursExceptionsPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const settings = await getBusinessSettings();

  return (
    <HoursExceptionsSettings
      initial={settings.hoursExceptions ?? []}
      locale={locale}
      timeZone={settings.timezone}
      now={new Date()}
    />
  );
}
