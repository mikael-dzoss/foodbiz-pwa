import { notFound } from "next/navigation";
import { getAddOnCandidates } from "@/domain/add-ons";
import {
  getDictionary,
  isSupportedLocale,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/domain/i18n";
import {
  getStorefrontCatalog,
  getStorefrontProduct,
  ProductDetailView,
} from "@/features/storefront";

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

  // Cached product query (#81) + cached catalog for add-on candidates (#206)
  const [productData, catalog] = await Promise.all([
    getStorefrontProduct(resolvedParams.id),
    getStorefrontCatalog(),
  ]);

  // Story #81 AC: Hidden products return 404
  if (!productData) {
    return notFound();
  }

  const catalogProducts = catalog.groupedCategories.flatMap((group) => group.products);
  const addOns = getAddOnCandidates(productData.product, catalog.categories, catalogProducts);

  return (
    <ProductDetailView
      productData={productData}
      addOns={addOns}
      locale={locale}
      dict={dict.storefront}
    />
  );
}
