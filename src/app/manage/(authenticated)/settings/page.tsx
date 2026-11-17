import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { SettingsHub } from "@/features/settings";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Settings | ${APP_METADATA.name}`,
  description: "Account, store preferences and system configuration.",
};

export default async function SettingsPage() {
  const session = await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);

  return <SettingsHub session={session} dict={dict.settings} />;
}
