import { APP_METADATA } from "@/config/app";
import { getStorefrontCatalog, getStorefrontProduct } from "@/features/storefront/catalog-data";
import {
  buildProductOgContent,
  buildShopOgContent,
  resolveStorefrontLocale,
} from "@/features/storefront/metadata";
import {
  renderProductOgImage,
  renderShopOgImage,
  resolveOgImageSrc,
} from "@/features/storefront/og-image";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export interface ProductOgImageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ProductOpenGraphImage({ params }: ProductOgImageProps) {
  const { locale: requested, id } = await params;
  const locale = resolveStorefrontLocale(requested);

  try {
    const productData = await getStorefrontProduct(id);
    if (productData) {
      const photoSrc = await resolveOgImageSrc(productData.product.imageUrl);
      return renderProductOgImage(
        buildProductOgContent({
          productName: productData.product.name,
          productDescription: productData.product.description,
          priceCents: productData.product.price,
          categoryName: productData.categoryName,
          businessName: productData.business.name,
          locale,
        }),
        photoSrc,
      );
    }

    const { business } = await getStorefrontCatalog();
    return renderShopOgImage(
      buildShopOgContent({
        businessName: business.name,
        description: business.description,
        address: business.address,
        locale,
      }),
    );
  } catch {
    return renderShopOgImage(
      buildShopOgContent({
        businessName: APP_METADATA.shortName,
        description: null,
        address: null,
        locale,
      }),
    );
  }
}
