import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { NotificationsAppForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Notifications & App | ${APP_METADATA.name}`,
  description: "Configure order alerts, sound chime, and PWA installation options.",
};

export default async function NotificationsPage() {
  await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const settings = await getBusinessSettings();

  return <NotificationsAppForm settings={settings} dict={dict.settings} />;
}
