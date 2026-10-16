import { notFound } from "next/navigation";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/domain/i18n";
import { getStorefrontProduct, ProductDetailView } from "@/features/storefront";

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const instant = false;

export interface ProductPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const locale: SupportedLocale = isSupportedLocale(resolvedParams.locale)
    ? resolvedParams.locale
    : DEFAULT_LOCALE;
  const dict = getDictionary(locale);

  // Cached product query with 'use cache' (#81)
  const productData = await getStorefrontProduct(resolvedParams.id);

  // Story #81 AC: Hidden products return 404
  if (!productData) {
    notFound();
  }

  return <ProductDetailView productData={productData} locale={locale} dict={dict.storefront} />;
}
