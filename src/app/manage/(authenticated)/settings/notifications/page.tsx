import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { NotificationsAppForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export const metadata: Metadata = {
  title: "Notifications & App",
  description: "Configure order alerts, sound chime, and PWA installation options.",
};

export default async function NotificationsPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
  const settings = await getBusinessSettings();

  return <NotificationsAppForm settings={settings} dict={dict.settings} />;
}
