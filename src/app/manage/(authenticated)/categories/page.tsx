import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listCategories } from "@/features/products/category-data";
import { CategoryManager } from "@/features/products/components/category-manager";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary } from "@/domain/i18n";
import { getManagerLocale } from "@/lib/i18n/manager-locale";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale()).categories;
  return {
    title: dict.title,
    description: dict.subtitle,
  };
}

export default async function CategoriesPage() {
  await requireManagerSession();
  const t = getDictionary(await getManagerLocale()).categories;
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Top Header from Stitch M-42 Contract */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/manage"
            aria-label={t.backToDashboard}
            className="text-foreground hover:bg-muted -ml-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-title-lg text-foreground">{t.title}</h1>
            <p className="text-muted-foreground text-xs">{t.subtitle}</p>
          </div>
        </div>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
