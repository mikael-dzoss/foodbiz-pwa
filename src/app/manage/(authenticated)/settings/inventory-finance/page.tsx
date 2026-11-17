import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { InventoryFinanceForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Inventory & Finance | ${APP_METADATA.name}`,
  description: "Configure stock warning thresholds, currency, and sales tax rate.",
};

export default async function InventoryFinancePage() {
  await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const settings = await getBusinessSettings();

  return <InventoryFinanceForm settings={settings} dict={dict.settings} />;
}
