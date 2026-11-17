import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listCategories } from "@/features/products/category-data";
import { CategoryManager } from "@/features/products/components/category-manager";
import { APP_METADATA } from "@/config/app";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: `Category Management | ${APP_METADATA.name}`,
  description: "Organise your menu and products.",
};

export const instant = false;

export default async function CategoriesPage() {
  await requireManagerSession();
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Top Header from Stitch M-42 Contract */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/manage"
            aria-label="Back to dashboard"
            className="text-foreground hover:bg-muted -ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-title-lg text-foreground">Categories</h1>
            <p className="text-muted-foreground text-xs">Organise your menu and products</p>
          </div>
        </div>
        {/* TODO(catalog): Wire to business ordering schedule / store status toggle (#71, #83) */}
        <span className="bg-primary-soft text-primary-soft-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
          Menu Active
        </span>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
