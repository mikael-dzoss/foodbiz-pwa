import { APP_METADATA } from "@/config/app";
import { getStorefrontCatalog } from "@/features/storefront/catalog-data";
import { buildShopOgContent, resolveStorefrontLocale } from "@/features/storefront/metadata";
import { renderShopOgImage } from "@/features/storefront/og-image";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Shop preview";

export interface ShopOgImageProps {
  params: Promise<{ locale: string }>;
}

export default async function ShopOpenGraphImage({ params }: ShopOgImageProps) {
  const locale = resolveStorefrontLocale((await params).locale);

  try {
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
        businessName: APP_METADATA.storefront.defaultName,
        description: null,
        address: null,
        locale,
      }),
    );
  }
}
