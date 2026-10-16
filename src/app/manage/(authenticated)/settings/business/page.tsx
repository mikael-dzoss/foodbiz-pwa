import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getDictionary, DEFAULT_LOCALE } from "@/domain/i18n";
import { getBusinessProfileAction, BusinessProfileForm } from "@/features/settings";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Business Profile | ${APP_METADATA.name}`,
  description: "Configure your public store details, contact channels and web address.",
};

export const instant = false;

export default async function BusinessProfilePage() {
  const session = await requireManagerSession();
  const dict = getDictionary(DEFAULT_LOCALE);
  const res = await getBusinessProfileAction();

  const business =
    res.success && res.data
      ? res.data
      : {
          id: session.business.id,
          name: session.business.name,
          slug: session.business.slug,
          currency: "EUR" as const,
          description: "",
          phone: "",
          email: "",
          whatsappNumber: "",
          address: "",
          logoUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

  return <BusinessProfileForm business={business} dict={dict.settings} />;
}
