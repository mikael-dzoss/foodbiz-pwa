import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listProductsAction } from "@/features/products/product-actions";
import { ProductManager } from "@/features/products/components/product-manager";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Products & Inventory | ${APP_METADATA.name}`,
  description: "Manage menu items, pricing, stock levels and categories.",
};

export const instant = false;

export default async function ProductsPage() {
  await requireManagerSession();
  const res = await listProductsAction();

  const products = res.success ? res.data.products : [];
  const categories = res.success ? res.data.categories : [];
  const lowStockThreshold = res.success ? res.data.lowStockThreshold : 5;

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
