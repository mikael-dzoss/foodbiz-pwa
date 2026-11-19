import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAddOnCandidates } from "@/domain/add-ons";
import { getDictionary } from "@/domain/i18n";
import { buildProductPageMetadata, resolveStorefrontLocale } from "@/features/storefront/metadata";
import {
  getStorefrontCatalog,
  getStorefrontProduct,
  ProductDetailView,
} from "@/features/storefront";

export interface ProductPageProps {
  params: Promise<{ locale: string; id: string }>;
}

// Awaits route params (locale/id/token) before rendering, so a navigation here genuinely blocks.
export const instant = false;

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale: requested, id } = await params;
  const locale = resolveStorefrontLocale(requested);
  const productData = await getStorefrontProduct(id);
  return buildProductPageMetadata({ locale, id, productData });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const locale = resolveStorefrontLocale(resolvedParams.locale);
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
