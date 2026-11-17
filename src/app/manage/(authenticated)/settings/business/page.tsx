import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { isOwnerRole } from "@/domain/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { BusinessProfileForm } from "@/features/settings";
import { getBusinessProfile } from "@/features/settings/settings-data";

export const metadata: Metadata = {
  title: "Business Profile",
  description: "Configure your public store details, contact channels and web address.",
};

export default async function BusinessProfilePage() {
  const session = await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const business = await getBusinessProfile();

  return (
    <BusinessProfileForm
      business={business}
      dict={dict.settings}
      slugLockedReason={isOwnerRole(session.user.role) ? undefined : dict.common.ownerOnlyNotice}
    />
  );
}
