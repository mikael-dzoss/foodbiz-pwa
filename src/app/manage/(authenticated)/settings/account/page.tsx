import type { Metadata } from "next";
import { cookies } from "next/headers";
import { requireManagerSession } from "@/lib/auth";
import {
  getDictionary,
  DEFAULT_LOCALE,
  isSupportedLocale,
  type SupportedLocale,
} from "@/domain/i18n";
import { AccountSettings } from "@/features/settings";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Account Settings | ${APP_METADATA.name}`,
  description: "Manage your profile, language and display preferences.",
};

export default async function AccountSettingsPage() {
  const session = await requireManagerSession();
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("foodbiz_locale")?.value;
  const currentLocale: SupportedLocale =
    localeCookie && isSupportedLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;

  const dict = getDictionary(currentLocale);

  return <AccountSettings session={session} dict={dict.settings} currentLocale={currentLocale} />;
}
