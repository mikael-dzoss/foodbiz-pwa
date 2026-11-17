import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { SettingsHub } from "@/features/settings";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export const metadata: Metadata = {
  title: "Settings",
  description: "Account, store preferences and system configuration.",
};

export default async function SettingsPage() {
  const session = await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);

  return <SettingsHub session={session} dict={dict.settings} />;
}
