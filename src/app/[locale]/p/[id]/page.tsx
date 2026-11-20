import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAddOnCandidates } from "@/domain/add-ons";
import { uuidSchema } from "@/domain/common";
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

const EMPTY_CATALOG_PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

// Wait for the complete static render on unlisted ids instead of streaming a 200 PPR fallback
// shell, so unknown or hidden products return a real HTTP 404 before response headers flush (#303).
export const ensureStatic = "navigation";

// Awaits route params (locale/id/token) before rendering, so a navigation here genuinely blocks.
export const instant = false;

export async function generateStaticParams() {
  const catalog = await getStorefrontCatalog();
  const productIds = catalog.groupedCategories.flatMap((group) =>
    group.products.map((product) => ({ id: product.id })),
  );
  // Cache Components requires at least one param set even when no products are visible yet.
  return productIds.length > 0 ? productIds : [{ id: EMPTY_CATALOG_PLACEHOLDER_ID }];
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale: requested, id } = await params;
  const locale = resolveStorefrontLocale(requested);
  const productData = uuidSchema.safeParse(id).success ? await getStorefrontProduct(id) : null;
  return buildProductPageMetadata({ locale, id, productData });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const resolvedParams = await params;
  const locale = resolveStorefrontLocale(resolvedParams.locale);
  const dict = getDictionary(locale);

  if (!uuidSchema.safeParse(resolvedParams.id).success) {
    return notFound();
  }

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
