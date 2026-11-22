import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { AccountSettings } from "@/features/settings";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.account;
  return {
    title: dict.title,
    description: dict.description,
  };
}

export default async function AccountSettingsPage() {
  const session = await requireManagerSession();
  const currentLocale = await getManagerLocale();

  const dict = getDictionary(currentLocale);

  return <AccountSettings session={session} dict={dict.settings} currentLocale={currentLocale} />;
}
