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
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2 sm:mx-0 sm:px-0"
    >
      <button
        type="button"
        onClick={() => onSelectCategory("all")}
        aria-pressed={selectedCategoryId === "all"}
        className={`focus-visible:ring-ring min-h-11 shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden ${
          selectedCategoryId === "all"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
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
            className={`focus-visible:ring-ring min-h-11 shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-hidden ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </nav>
  );
}
