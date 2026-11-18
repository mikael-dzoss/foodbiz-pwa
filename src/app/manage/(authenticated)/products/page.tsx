import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listProducts } from "@/features/products/product-data";
import { ProductManager } from "@/features/products/components/product-manager";

export const metadata: Metadata = {
  title: "Products & Inventory",
  description: "Manage menu items, pricing, stock levels and categories.",
};

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
