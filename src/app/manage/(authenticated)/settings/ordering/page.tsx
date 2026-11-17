import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { OrderingSettingsForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";

export const metadata: Metadata = {
  title: "Ordering Settings",
  description: "Configure order acceptance, fulfillment modes, and delivery rules.",
};

export default async function OrderingSettingsPage() {
  await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const settings = await getBusinessSettings();

  return <OrderingSettingsForm settings={settings} dict={dict.settings} locale={DEFAULT_LOCALE} />;
}
