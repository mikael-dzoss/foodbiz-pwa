import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { OrderingSettingsForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export const metadata: Metadata = {
  title: "Ordering Settings",
  description: "Configure order acceptance, fulfillment modes, and delivery rules.",
};

export default async function OrderingSettingsPage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
  const settings = await getBusinessSettings();

  return <OrderingSettingsForm settings={settings} dict={dict.settings} locale={locale} />;
}
