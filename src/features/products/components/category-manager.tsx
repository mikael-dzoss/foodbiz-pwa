"use client";

import { useState, type FormEvent } from "react";
import { categoryRoleSchema, type CategoryRole } from "@/domain/category";
import { getDictionary, type ProductsDictionary } from "@/domain/i18n";
import type { ProductCategory } from "@/domain/product";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
} from "../category-actions";
import { Plus, Edit2, Trash2, Check, X, Folder, GripVertical, Info, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { CategoryWithProductCount } from "../category-data";
import { actionErrorMessage } from "@/lib/actions/error-message";

export interface CategoryManagerProps {
  initialCategories: CategoryWithProductCount[];
  dict?: ProductsDictionary;
}

export function CategoryManager({
  initialCategories,
  dict = getDictionary().products,
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<CategoryWithProductCount[]>(initialCategories);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<CategoryRole>("regular");
  const [editRole, setEditRole] = useState<CategoryRole>("regular");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    const res = await createCategoryAction({ name: newName, role: newRole });
    setIsCreating(false);

    if (res.ok) {
      setCategories((prev) => [...prev, { ...res.data, productCount: 0 }]);
      setNewName("");
      setNewRole("regular");
    } else {
      setCreateError(actionErrorMessage(res));
    }
  };

  const startEditing = (cat: ProductCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditRole(cat.role);
    setRenameError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setRenameError(null);
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    setRenameError(null);

    const res = await renameCategoryAction({ id, name: editName, role: editRole });
    if (res.ok) {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: res.data.name, role: res.data.role } : c)),
      );
      setEditingId(null);
      setEditName("");
    } else {
      setRenameError(actionErrorMessage(res));
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteError(null);
    setDeletingId(id);

    const res = await deleteCategoryAction({ id });
    setDeletingId(null);

    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } else {
      setDeleteError(actionErrorMessage(res));
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Add Category Section (Stitch M-42 Form Card) */}
      <section className="bg-card border-border rounded-lg border p-4 shadow-none sm:p-5">
        <form onSubmit={handleCreate} className="space-y-3">
          <h2 className="text-foreground text-sm font-semibold">Add New Category</h2>

          <div>
            <label
              htmlFor="new-category-name-input"
              className="text-muted-foreground mb-1.5 block text-xs font-medium"
            >
              Category name
            </label>
            <div className="relative">
              {/* TODO(design): scale down h-12/text-base to h-11/text-sm to match Stitch mobile tokens */}
              <Input
                id="new-category-name-input"
                type="text"
                placeholder="e.g. Desserts, Drinks..."
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  if (createError) setCreateError(null);
                }}
                className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-12 rounded-lg text-base"
                data-testid="new-category-name-input"
                aria-label="New category name"
              />
            </div>
            <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[11px]">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>Visible in ordering menu and kitchen tickets</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="new-category-role"
              className="text-muted-foreground mb-1.5 block text-xs font-medium"
            >
              {dict.categoryRoleLabel}
            </label>
            <select
              id="new-category-role"
              value={newRole}
              onChange={(e) => setNewRole(categoryRoleSchema.parse(e.target.value))}
              disabled={isCreating}
              className="border-input bg-background text-foreground focus-visible:ring-ring min-h-11 w-full rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
              data-testid="new-category-role-select"
            >
              {categoryRoleSchema.options.map((role) => (
                <option key={role} value={role}>
                  {dict.categoryRoles[role]}
                </option>
              ))}
            </select>
          </div>

          {/* TODO(design): scale down button from h-12 to min-h-11 (h-10 or h-11) */}
          <Button
            id="create-category-btn"
            data-testid="create-category-button"
            type="submit"
            disabled={isCreating || !newName.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary h-12 w-full gap-2 rounded-lg text-sm font-semibold shadow-none"
          >
            <Plus className="h-4 w-4" />
            <span>Add Category</span>
          </Button>

          {createError && (
            <p role="alert" className="text-destructive mt-1 text-xs font-medium">
              {createError}
            </p>
          )}
        </form>
      </section>

      {/* Global Action Error Banner */}
      {deleteError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between rounded-lg border p-3.5 text-xs font-medium"
        >
          <span>{deleteError}</span>
          <button
            type="button"
            data-testid="dismiss-category-error"
            onClick={() => setDeleteError(null)}
            className="text-destructive/80 hover:text-destructive min-h-11 min-w-11 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Categories List Section (Stitch M-42 List Card) */}
      <section className="bg-card border-border rounded-lg border shadow-none">
        {/* Section Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-foreground text-sm font-semibold">
              All Categories <span className="sr-only">Categories ({categories.length})</span>
            </h2>
            <span className="bg-muted text-foreground border-border rounded-full border px-2 py-0.5 text-xs font-semibold">
              {categories.length}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">Drag to reorder</span>
        </div>

        {/* List items */}
        {categories.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center p-8 text-center text-sm">
            <Folder className="mb-2 h-8 w-8 opacity-40" />
            <p>No categories yet. Create your first category above.</p>
          </div>
        ) : (
          <div className="divide-border divide-y" role="list">
            {categories.map((cat) => {
              const isEditing = editingId === cat.id;

              if (isEditing) {
                return (
                  <div key={cat.id} className="bg-card p-3.5">
                    <div className="mb-2">
                      <label
                        htmlFor={`edit-category-role-${cat.id}`}
                        className="text-muted-foreground mb-1.5 block text-xs font-medium"
                      >
                        {dict.categoryRoleLabel}
                      </label>
                      <select
                        id={`edit-category-role-${cat.id}`}
                        value={editRole}
                        onChange={(e) => setEditRole(categoryRoleSchema.parse(e.target.value))}
                        className="border-input bg-background text-foreground focus-visible:ring-ring min-h-11 w-full rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
                        data-testid={`edit-category-role-select-${cat.id}`}
                      >
                        {categoryRoleSchema.options.map((role) => (
                          <option key={role} value={role}>
                            {dict.categoryRoles[role]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`edit-category-name-${cat.id}`}
                        data-testid={`edit-category-name-input-${cat.id}`}
                        type="text"
                        value={editName}
                        onChange={(e) => {
                          setEditName(e.target.value);
                          if (renameError) setRenameError(null);
                        }}
                        className="min-h-11 flex-1 text-sm"
                        aria-label="Edit category name"
                        autoFocus
                      />
                      <Button
                        id={`save-category-btn-${cat.id}`}
                        data-testid={`save-category-button-${cat.id}`}
                        size="sm"
                        onClick={() => handleRename(cat.id)}
                        disabled={!editName.trim()}
                        className="min-h-11 min-w-11 shrink-0 gap-1"
                        aria-label="Save category name"
                      >
                        <Check className="h-4 w-4" />
                        <span>Save</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`cancel-category-edit-${cat.id}`}
                        onClick={cancelEditing}
                        className="min-h-11 min-w-11 shrink-0"
                        aria-label="Cancel editing"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {renameError && (
                      <p role="alert" className="text-destructive mt-1 text-xs font-medium">
                        {renameError}
                      </p>
                    )}
                  </div>
                );
              }

              const productCount = cat.productCount ?? 0;
              const inCatalog = productCount > 0;

              return (
                <div
                  key={cat.id}
                  className="hover:bg-muted/30 flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors"
                  role="listitem"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      data-testid={`reorder-category-${cat.id}`}
                      aria-label={`Reorder ${cat.name}`}
                      className="text-muted-foreground/60 hover:text-foreground -ml-1 min-h-11 min-w-11 touch-manipulation p-1"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="text-foreground truncate text-sm font-semibold">
                        {cat.name}
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          {dict.categoryRoles[cat.role]}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                        <span className="font-medium">
                          {productCount} {productCount === 1 ? "product" : "products"}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        {inCatalog ? (
                          <span className="bg-primary-soft text-primary-soft-foreground inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold">
                            In catalog
                          </span>
                        ) : (
                          <span className="bg-destructive/10 text-destructive inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      id={`rename-category-btn-${cat.id}`}
                      data-testid={`rename-category-button-${cat.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(cat)}
                      className="text-foreground hover:bg-muted min-h-11 min-w-11 gap-1 text-xs font-medium"
                      aria-label={`Rename ${cat.name}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>

                    <Button
                      id={`delete-category-btn-${cat.id}`}
                      data-testid={`delete-category-button-${cat.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(cat.id)}
                      disabled={inCatalog || deletingId === cat.id}
                      className={
                        inCatalog
                          ? "text-muted-foreground/60 min-h-11 min-w-11 cursor-not-allowed p-2 opacity-60"
                          : "text-destructive hover:bg-destructive/10 min-h-11 min-w-11 p-2"
                      }
                      aria-label={
                        inCatalog
                          ? `Delete ${cat.name} (in use by ${productCount} items)`
                          : `Delete ${cat.name}`
                      }
                      title={inCatalog ? `In use by ${productCount} item(s)` : undefined}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Card Summary Footer */}
        {/* Recommendation: If an offline POS or kitchen terminal sync bridge is introduced in the future (#71), add the live sync indicator here. Currently, categories sync reactively to storefront via Server Actions. */}
        <div className="bg-muted/40 border-border text-muted-foreground flex items-center justify-between border-t px-4 py-2.5 text-xs">
          <span>
            {categories.length} {categories.length === 1 ? "category" : "categories"}
          </span>
          <span className="text-foreground font-medium">
            {categories.reduce((sum, c) => sum + (c.productCount ?? 0), 0)} products total
          </span>
        </div>
      </section>

      {/* 3. Context Helper Card from Stitch M-42 Contract */}
      <div className="bg-card border-border flex items-start gap-3 rounded-lg border p-3.5 shadow-none">
        <Lightbulb className="text-primary mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-foreground font-semibold">Pro tip:</strong> Categories with active
          products cannot be removed directly to prevent orphaned items in your store.
        </div>
      </div>
    </div>
  );
}
