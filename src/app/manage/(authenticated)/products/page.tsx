import type { Metadata } from "next";
import { getDictionary } from "@/domain/i18n";
import { requireManagerSession } from "@/lib/auth";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { listProducts } from "@/features/products/product-data";
import { ProductManager } from "@/features/products/components/product-manager";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).productsAdmin;
  return {
    title: dict.title,
    description: dict.subtitle,
  };
}

interface ProductsPageProps {
  searchParams?: Promise<{ action?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps = {}) {
  await requireManagerSession();
  const params = searchParams ? await searchParams : undefined;
  const { products, categories, lowStockThreshold } = await listProducts();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ProductManager
        initialProducts={products}
        categories={categories}
        lowStockThreshold={lowStockThreshold}
        initialAction={params?.action}
      />
    </div>
  );
}
