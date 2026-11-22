import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { InventoryFinanceForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.inventoryFinance;
  return {
    title: dict.title,
    description: dict.description,
  };
}

export default async function InventoryFinancePage() {
  await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
  const settings = await getBusinessSettings();

  return <InventoryFinanceForm settings={settings} dict={dict.settings} />;
}
