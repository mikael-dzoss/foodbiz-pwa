import type { Metadata } from "next";
import { connection } from "next/server";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { HoursExceptionsSettings } from "@/features/settings/components/hours-exceptions-settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

// Request-time page: compares hours exceptions against the current date.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.hoursExceptions;
  return { title: dict.title, description: dict.description };
}

export default async function HoursExceptionsPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const settings = await getBusinessSettings();
  await connection();

  return (
    <HoursExceptionsSettings
      initial={settings.hoursExceptions ?? []}
      locale={locale}
      timeZone={settings.timezone}
      now={new Date()}
    />
  );
}
