import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listProducts } from "@/features/products/product-data";
import { ProductManager } from "@/features/products/components/product-manager";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Products & Inventory | ${APP_METADATA.name}`,
  description: "Manage menu items, pricing, stock levels and categories.",
};

export default async function ProductsPage() {
  await requireManagerSession();
  const { products, categories, lowStockThreshold } = await listProducts();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ProductManager
        initialProducts={products}
        categories={categories}
        lowStockThreshold={lowStockThreshold}
      />
    </div>
  );
}
