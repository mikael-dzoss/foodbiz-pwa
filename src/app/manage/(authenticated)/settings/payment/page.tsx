import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { isOwnerRole } from "@/domain/auth";
import { getDictionary } from "@/domain/i18n";
import { PaymentSettingsForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.payment;
  return {
    title: dict.title,
    description: dict.description,
  };
}

export default async function PaymentSettingsPage() {
  const session = await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
  const settings = await getBusinessSettings();

  return (
    <PaymentSettingsForm
      settings={settings}
      dict={dict.settings}
      readOnlyReason={isOwnerRole(session.user.role) ? undefined : dict.common.ownerOnlyNotice}
    />
  );
}
