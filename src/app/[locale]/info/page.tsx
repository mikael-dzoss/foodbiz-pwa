import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, interpolate, SUPPORTED_LOCALES } from "@/domain/i18n";
import {
  buildStorefrontPageSocialMetadata,
  resolveStorefrontLocale,
  storefrontAlternates,
} from "@/features/storefront/metadata";
import { getStorefrontCatalog, ShopInfoView } from "@/features/storefront";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

// No storefront loading boundary (the catalog is cached), so this navigation blocks on the page read.
export const instant = false;

export interface ShopInfoPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ShopInfoPageProps): Promise<Metadata> {
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale).storefront;
  const { business } = await getStorefrontCatalog();
  const description = interpolate(dict.metaInfoDescription, { business: business.name });
  return {
    title: dict.shopInfo,
    description,
    alternates: storefrontAlternates(locale, "/info"),
    ...buildStorefrontPageSocialMetadata({
      title: dict.shopInfo,
      description,
      businessName: business.name,
      locale,
    }),
  };
}

export default async function ShopInfoPage({ params }: ShopInfoPageProps) {
  const locale = resolveStorefrontLocale((await params).locale);
  const dict = getDictionary(locale);

  // Cached storefront business & settings query (#83)
  const catalog = await getStorefrontCatalog();

  return (
    <Suspense fallback={null}>
      <ShopInfoView
        business={catalog.business}
        settings={catalog.settings}
        locale={locale}
        dict={dict.storefront}
      />
    </Suspense>
  );
}
