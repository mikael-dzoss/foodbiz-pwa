"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  X,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Package,
  Layers,
  SlidersHorizontal,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CategoryNav, prefersReducedMotion, useScrollSpy } from "@/components/navigation";
import { formatMoney, getStockStatus } from "@/domain";
import { adjustProductStockAction, toggleProductVisibilityAction } from "../product-actions";
import type { EnrichedProduct } from "../product-data";
import type { ProductCategory, Product } from "@/domain";
import { ProductFormSheet } from "./product-form-sheet";
import { StockAdjustmentSheet } from "./stock-adjustment-sheet";

export interface ProductManagerProps {
  initialProducts: EnrichedProduct[];
  categories: ProductCategory[];
  lowStockThreshold?: number;
}

export function ProductManager({
  initialProducts,
  categories,
  lowStockThreshold = 5,
}: ProductManagerProps) {
  const [products, setProducts] = React.useState<EnrichedProduct[]>(initialProducts);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedFilter, setSelectedFilter] = React.useState<string>("all");

  // Sheet states
  const [formSheetOpen, setFormSheetOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<EnrichedProduct | null>(null);

  const [stockSheetOpen, setStockSheetOpen] = React.useState(false);
  const [stockAdjustProduct, setStockAdjustProduct] = React.useState<EnrichedProduct | null>(null);

  const [prevInitial, setPrevInitial] = React.useState<EnrichedProduct[]>(initialProducts);
  if (initialProducts !== prevInitial) {
    setPrevInitial(initialProducts);
    setProducts(initialProducts);
  }

  // Derived counts
  const totalCount = products.length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= lowStockThreshold).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const hiddenCount = products.filter((p) => !p.visible).length;

  // Filtering
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      // Search by name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesCat = p.categoryName?.toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      // Filter chips
      if (selectedFilter === "low_stock") {
        return p.stock > 0 && p.stock <= lowStockThreshold;
      }
      if (selectedFilter === "hidden") {
        return !p.visible;
      }

      return true;
    });
  }, [products, searchQuery, selectedFilter, lowStockThreshold]);

  // Group filtered products by category sorted by sortOrder (#205)
  const groupedCategories = React.useMemo(() => {
    const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const groupMap = new Map<
      string,
      { id: string; name: string; sortOrder: number; products: EnrichedProduct[] }
    >();
    for (const cat of sortedCats) {
      groupMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
        products: [],
      });
    }

    const uncategorized: EnrichedProduct[] = [];
    for (const product of filteredProducts) {
      const group = groupMap.get(product.categoryId);
      if (group) {
        group.products.push(product);
      } else {
        uncategorized.push(product);
      }
    }

    const groups = Array.from(groupMap.values()).filter((g) => g.products.length > 0);
    if (uncategorized.length > 0) {
      groups.push({
        id: "uncategorized",
        name: "Uncategorized",
        sortOrder: 9999,
        products: uncategorized,
      });
    }
    return groups;
  }, [categories, filteredProducts]);

  const sectionIds = React.useMemo(() => groupedCategories.map((g) => g.id), [groupedCategories]);
  const navItems = React.useMemo(
    () => groupedCategories.map((g) => ({ id: g.id, label: g.name })),
    [groupedCategories],
  );
  const { activeId, setActiveId } = useScrollSpy(sectionIds);

  const handleSelectCategory = (categoryId: string) => {
    setActiveId(categoryId);
    const heading = document.getElementById(`category-heading-${categoryId}`);
    if (!heading) return;

    if (typeof heading.scrollIntoView === "function") {
      heading.scrollIntoView({
        behavior: prefersReducedMotion() ? "instant" : "smooth",
        block: "start",
      });
    }
    heading.focus({ preventScroll: true });
  };

  // Quick Inline Stock Adjustment (+1 / -1)
  const handleQuickStockStep = async (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const newStock = Math.max(0, product.stock + delta);

    // Optimistic UI update
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p)));

    const res = await adjustProductStockAction({ productId, stock: newStock });
    if (!res.ok) {
      // Rollback on error
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: product.stock } : p)),
      );
    }
  };

  // Quick Visibility Toggle (Soft delete)
  const handleToggleVisibility = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const newVisible = !product.visible;

    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, visible: newVisible } : p)),
    );

    const res = await toggleProductVisibilityAction({ productId, visible: newVisible });
    if (!res.ok) {
      // Rollback on error
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, visible: product.visible } : p)),
      );
    }
  };

  // Handlers to open sheets
  const handleOpenAddForm = () => {
    setEditingProduct(null);
    setFormSheetOpen(true);
  };

  const handleOpenEditForm = (product: EnrichedProduct) => {
    setEditingProduct(product);
    setFormSheetOpen(true);
  };

  const handleOpenStockSheet = (product: EnrichedProduct) => {
    setStockAdjustProduct(product);
    setStockSheetOpen(true);
  };

  const handleProductSaved = (saved: Product) => {
    const catName = categories.find((c) => c.id === saved.categoryId)?.name ?? "Uncategorized";
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...saved, categoryName: catName };
        return copy;
      }
      return [{ ...saved, categoryName: catName }, ...prev];
    });
  };

  const handleStockAdjusted = (productId: string, newStock: number) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p)));
  };

  return (
    <div className="space-y-4" data-testid="product-manager">
      {/* Top Header Bar based on Stitch M-40 contract */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-foreground text-xl font-bold tracking-tight">Products</h1>
              <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums">
                {totalCount}
              </span>
            </div>
            <p className="text-muted-foreground text-xs font-medium">
              Manage menu items, pricing, and stock
            </p>
          </div>

          {/* TODO(catalog): wire to business ordering schedule / store status toggle (#71, #83) */}
          <span className="bg-primary-soft text-primary-soft-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            <span className="bg-primary inline-block h-1.5 w-1.5 rounded-full" />
            Menu Active
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Link
            href="/manage/categories"
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors"
          >
            <Layers className="h-4 w-4" />
            Categories ({categories.length})
          </Link>

          <Button
            type="button"
            onClick={handleOpenAddForm}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-3.5 text-xs font-semibold"
            data-testid="add-product-button"
          >
            <Plus className="mr-1 h-4 w-4 stroke-[2.5]" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-3 left-3 h-4 w-4" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name..."
            className="h-11 pr-9 pl-9 text-sm"
            data-testid="product-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-3 right-3"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Scrollable Filter Chips */}
        <div
          role="tablist"
          aria-label="Filter products"
          className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedFilter === "all"}
            onClick={() => setSelectedFilter("all")}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selectedFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted border"
            }`}
          >
            All ({totalCount})
          </button>

          {lowStockCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={selectedFilter === "low_stock"}
              onClick={() => setSelectedFilter("low_stock")}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedFilter === "low_stock"
                  ? "bg-warning-soft text-warning-soft-foreground border-warning-soft border font-bold"
                  : "border-warning/30 bg-warning-soft/40 text-warning-soft-foreground hover:bg-warning-soft/70 border"
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
          )}

          {hiddenCount > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={selectedFilter === "hidden"}
              onClick={() => setSelectedFilter("hidden")}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedFilter === "hidden"
                  ? "bg-muted text-foreground border-border border font-bold"
                  : "border-border bg-card text-muted-foreground hover:bg-muted border"
              }`}
            >
              Hidden ({hiddenCount})
            </button>
          )}
        </div>
      </div>

      {/* Sticky Category Navigation Ribbon (Stitch M-40, #205) */}
      {navItems.length > 0 && (
        <div data-testid="manager-category-nav" className="sticky top-0 z-30 -mx-4 sm:mx-0">
          <CategoryNav
            items={navItems}
            activeId={activeId}
            onSelect={handleSelectCategory}
            menuTitle="Categories"
            menuSubtitle={`${filteredProducts.length} ${filteredProducts.length === 1 ? "product" : "products"}`}
            menuLabel="Browse categories"
            dismissLabel="Dismiss"
          />
        </div>
      )}

      {/* Product List View Grouped by Category */}
      {groupedCategories.length > 0 ? (
        <div className="space-y-6" data-testid="product-list">
          {groupedCategories.map((group) => (
            <section
              key={group.id}
              id={`category-section-${group.id}`}
              aria-labelledby={`category-heading-${group.id}`}
              data-testid={`category-section-${group.id}`}
              className="space-y-3"
            >
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <h2
                    id={`category-heading-${group.id}`}
                    tabIndex={-1}
                    className="text-muted-foreground scroll-mt-20 text-xs font-bold tracking-wider uppercase focus:outline-hidden"
                  >
                    {group.name}
                  </h2>
                  <span
                    data-testid={`category-count-${group.id}`}
                    className="text-muted-foreground text-xs font-medium tabular-nums"
                  >
                    · {group.products.length}
                  </span>
                </div>
              </div>

              <div className="space-y-3" data-testid={`category-group-${group.id}`}>
                {group.products.map((p) => {
                  const stockStatus = getStockStatus(p.stock, lowStockThreshold);
                  return (
                    <div
                      key={p.id}
                      data-testid={`product-card-${p.id}`}
                      className={`border-border bg-card rounded-lg border p-3.5 transition-shadow ${
                        !p.visible ? "opacity-75" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail Image with Next/Image and product name alt */}
                        <div className="border-border bg-muted/40 relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                          {p.imageUrl ? (
                            <Image
                              src={p.imageUrl}
                              alt={p.name}
                              fill
                              sizes="64px"
                              unoptimized={p.imageUrl.startsWith("data:")}
                              className="object-cover"
                            />
                          ) : (
                            <Package className="text-muted-foreground h-7 w-7" />
                          )}
                        </div>

                        {/* Main Product Details */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-foreground truncate text-sm font-semibold">
                              {p.name}
                            </h3>
                            <span className="text-foreground text-sm font-bold tabular-nums">
                              {formatMoney(p.price)}
                            </span>
                          </div>

                          <p className="text-muted-foreground truncate text-xs font-medium">
                            {p.categoryName}
                            {p.unitCost > 0 && (
                              <span className="tabular-nums">
                                {" "}
                                · Cost: {formatMoney(p.unitCost)}
                              </span>
                            )}
                          </p>

                          {/* Status & Visibility Badges */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {stockStatus === "out_of_stock" && (
                              <Badge variant="destructive" className="font-semibold tabular-nums">
                                0 in stock
                              </Badge>
                            )}
                            {stockStatus === "low_stock" && (
                              <Badge variant="warning" className="font-semibold tabular-nums">
                                <AlertTriangle className="mr-1 inline h-3 w-3" />
                                {p.stock} left
                              </Badge>
                            )}
                            {stockStatus === "in_stock" && (
                              <Badge variant="success" className="font-semibold tabular-nums">
                                {p.stock} in stock
                              </Badge>
                            )}

                            {p.visible ? (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground text-caption gap-1"
                              >
                                <Eye className="h-3 w-3" /> Visible
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-caption gap-1">
                                <EyeOff className="h-3 w-3" /> Hidden
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Controls Row */}
                      <div className="border-border mt-3 flex items-center justify-between border-t pt-2.5">
                        {/* Quick Stock Controls (- / count / +) */}
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuickStockStep(p.id, -1)}
                            disabled={p.stock <= 0}
                            className="text-foreground hover:bg-muted h-9 w-9"
                            aria-label={`Decrease stock for ${p.name}`}
                            data-testid={`quick-stock-minus-${p.id}`}
                          >
                            -
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleOpenStockSheet(p)}
                            aria-label={`${p.stock} - Open stock sheet for ${p.name}`}
                            className="hover:bg-muted text-foreground flex h-9 min-w-10 items-center justify-center rounded-md px-1.5 text-xs font-bold tabular-nums transition-colors"
                            data-testid={`quick-stock-count-${p.id}`}
                          >
                            {p.stock}
                          </button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuickStockStep(p.id, 1)}
                            className="text-foreground hover:bg-muted h-9 w-9"
                            aria-label={`Increase stock for ${p.name}`}
                            data-testid={`quick-stock-plus-${p.id}`}
                          >
                            +
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStockSheet(p)}
                            className="text-muted-foreground hover:text-foreground h-9 px-2 text-xs"
                            aria-label={`Adjust stock for ${p.name}`}
                          >
                            <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Adjust
                          </Button>
                        </div>

                        {/* Edit and Visibility Toggle Actions */}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleVisibility(p.id)}
                            className="text-muted-foreground hover:text-foreground h-9 w-9"
                            aria-label={p.visible ? `Hide ${p.name}` : `Show ${p.name}`}
                            data-testid={`toggle-visibility-${p.id}`}
                          >
                            {p.visible ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenEditForm(p)}
                            className="text-foreground hover:bg-muted h-9 w-9"
                            aria-label={`Edit ${p.name}`}
                            data-testid={`edit-product-${p.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : totalCount === 0 ? (
        /* Empty State: No products exist */
        <div
          data-testid="empty-products"
          className="border-border bg-card rounded-lg border p-8 text-center"
        >
          <div className="bg-primary-soft text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-full">
            <Package className="h-7 w-7" />
          </div>
          <h2 className="text-foreground mt-3 text-base font-bold">No products yet</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-xs text-xs">
            Start building your menu by adding your first product with prices and stock.
          </p>
          <Button
            type="button"
            onClick={handleOpenAddForm}
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 text-xs font-semibold"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add your first product
          </Button>
        </div>
      ) : (
        /* No Results State: Search or filter returned 0 results */
        <div
          data-testid="no-results-products"
          className="border-border bg-card rounded-lg border p-8 text-center"
        >
          <div className="bg-muted text-muted-foreground mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="text-foreground mt-3 text-sm font-bold">No matching products</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            No products match &ldquo;{searchQuery}&rdquo; in the selected filter.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setSelectedFilter("all");
            }}
            className="mt-4 text-xs font-semibold"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Clear filters
          </Button>
        </div>
      )}

      {/* Summary footer: clean grounded alternative to speculative POS sync footer */}
      <div className="border-border bg-muted/20 text-muted-foreground flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-xs">
        <span>
          {totalCount} total products across {categories.length} categories
        </span>
        <span className="tabular-nums">
          {totalCount - outOfStockCount} active · {outOfStockCount} out of stock
        </span>
      </div>

      {/* Integrated Product Form Sheet (Screen M-41) */}
      <ProductFormSheet
        product={editingProduct}
        categories={categories}
        isOpen={formSheetOpen}
        onOpenChange={setFormSheetOpen}
        onProductSaved={handleProductSaved}
        lowStockThreshold={lowStockThreshold}
      />

      {/* Integrated Stock Adjustment Sheet (Screen M-43) */}
      <StockAdjustmentSheet
        product={stockAdjustProduct}
        isOpen={stockSheetOpen}
        onOpenChange={setStockSheetOpen}
        onStockAdjusted={handleStockAdjusted}
        lowStockThreshold={lowStockThreshold}
      />
    </div>
  );
}
