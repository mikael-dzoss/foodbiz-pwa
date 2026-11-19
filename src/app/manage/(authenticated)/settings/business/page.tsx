import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { isOwnerRole } from "@/domain/auth";
import { getDictionary } from "@/domain/i18n";
import { BusinessProfileForm } from "@/features/settings";
import { getBusinessProfile } from "@/features/settings/settings-data";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).settings.business;
  return {
    title: dict.title,
    description: dict.description,
  };
}

export default async function BusinessProfilePage() {
  const session = await requireManagerSession();
  const locale = await getManagerLocale();
  const dict = getDictionary(locale);
  const business = await getBusinessProfile();

  return (
    <BusinessProfileForm
      business={business}
      dict={dict.settings}
      slugLockedReason={isOwnerRole(session.user.role) ? undefined : dict.common.ownerOnlyNotice}
    />
  );
}
