import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { AccountSettings } from "@/features/settings";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your profile, language and display preferences.",
};

export default async function AccountSettingsPage() {
  const session = await requireManagerSession();
  const currentLocale = await getManagerLocale();

  const dict = getDictionary(currentLocale);

  return <AccountSettings session={session} dict={dict.settings} currentLocale={currentLocale} />;
}
