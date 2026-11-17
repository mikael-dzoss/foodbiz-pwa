import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { isOwnerRole } from "@/domain/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { PaymentSettingsForm } from "@/features/settings";
import { getBusinessSettings } from "@/features/settings/settings-data";

export const metadata: Metadata = {
  title: "Payment Settings",
  description: "Configure accepted payment methods, transfer identifiers, and instructions.",
};

export default async function PaymentSettingsPage() {
  const session = await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const settings = await getBusinessSettings();

  return (
    <PaymentSettingsForm
      settings={settings}
      dict={dict.settings}
      readOnlyReason={isOwnerRole(session.user.role) ? undefined : dict.common.ownerOnlyNotice}
    />
  );
}
