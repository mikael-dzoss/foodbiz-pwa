"use client";

import type { ProductCategory } from "@/domain/product";

export interface CategoryTabsProps {
  categories: ProductCategory[];
  selectedCategoryId: string | "all";
  onSelectCategory: (id: string | "all") => void;
  allLabel: string;
}

export function CategoryTabs({
  categories,
  selectedCategoryId,
  onSelectCategory,
  allLabel,
}: CategoryTabsProps) {
  return (
    <nav
      aria-label="Product categories"
      className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0"
    >
      <button
        type="button"
        onClick={() => onSelectCategory("all")}
        aria-pressed={selectedCategoryId === "all"}
        className={`focus-visible:ring-ring flex h-8 shrink-0 items-center rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-hidden ${
          selectedCategoryId === "all"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        }`}
      >
        {allLabel}
      </button>

      {categories.map((cat) => {
        const isSelected = selectedCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            aria-pressed={isSelected}
            className={`focus-visible:ring-ring flex h-8 shrink-0 items-center rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-hidden ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </nav>
  );
}
