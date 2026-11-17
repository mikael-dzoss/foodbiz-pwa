"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { allergenSchema, type Allergen } from "@/domain/allergen";
import { getDictionary, type ProductsDictionary } from "@/domain/i18n";
import Image from "next/image";
import { Camera, Check, Loader2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  calculateGrossMargin,
  centsToEuroString,
  parseEuroStringToCents,
  productFormInputSchema,
  type ProductCategory,
  type Product,
} from "@/domain";
import {
  createProductAction,
  updateProductAction,
  uploadProductImageAction,
} from "../product-actions";
import type { EnrichedProduct } from "../product-data";
import { compressImageFile } from "../utils/image-compression";
import { actionErrorMessage } from "@/lib/actions/error-message";

export interface ProductFormSheetProps {
  product?: EnrichedProduct | null;
  categories: ProductCategory[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProductSaved?: (product: Product) => void;
  lowStockThreshold?: number;
  dict?: ProductsDictionary;
}

export function ProductFormSheet({
  product,
  categories,
  isOpen,
  onOpenChange,
  onProductSaved,
  lowStockThreshold = 5,
  dict = getDictionary().products,
}: ProductFormSheetProps) {
  const isEditing = Boolean(product);

  const [prevProduct, setPrevProduct] = useState<EnrichedProduct | null>(product ?? null);
  const [prevIsOpen, setPrevIsOpen] = useState<boolean>(isOpen);

  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [priceStr, setPriceStr] = useState(product ? centsToEuroString(product.price) : "");
  const [unitCostStr, setUnitCostStr] = useState(
    product?.unitCost ? centsToEuroString(product.unitCost) : "",
  );
  const [stock, setStock] = useState(product?.stock ?? 0);
  const [suggestAddOns, setSuggestAddOns] = useState(product?.suggestAddOns ?? true);
  const [allergens, setAllergens] = useState<Allergen[]>(product?.allergens ?? []);
  const [visible, setVisible] = useState(product?.visible ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(product?.imageUrl ?? null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const normalizedProduct = product ?? null;

  // Sync state with product prop and isOpen changes during render
  if (normalizedProduct !== prevProduct || isOpen !== prevIsOpen) {
    setPrevProduct(normalizedProduct);
    setPrevIsOpen(isOpen);
    if (isOpen) {
      if (normalizedProduct) {
        setName(normalizedProduct.name);
        setCategoryId(normalizedProduct.categoryId);
        setDescription(normalizedProduct.description ?? "");
        setPriceStr(centsToEuroString(normalizedProduct.price));
        setUnitCostStr(
          normalizedProduct.unitCost ? centsToEuroString(normalizedProduct.unitCost) : "",
        );
        setStock(normalizedProduct.stock);
        setVisible(normalizedProduct.visible);
        setAllergens(normalizedProduct.allergens);
        setSuggestAddOns(normalizedProduct.suggestAddOns);
        setImageUrl(normalizedProduct.imageUrl ?? null);
      } else {
        setName("");
        setCategoryId(categories[0]?.id ?? "");
        setDescription("");
        setPriceStr("");
        setUnitCostStr("");
        setStock(0);
        setVisible(true);
        setAllergens([]);
        setSuggestAddOns(true);
        setImageUrl(null);
      }
      setFieldErrors({});
      setGeneralError(null);
    }
  }

  // Live gross margin preview
  const priceInCents = parseEuroStringToCents(priceStr) || 0;
  const costInCents = parseEuroStringToCents(unitCostStr) || 0;
  const grossMargin = calculateGrossMargin(priceInCents, costInCents);

  const handleImageFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingImage(true);
      setGeneralError(null);

      // Client-side resize and compression per Story #45
      const compressed = await compressImageFile(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
      });

      // Upload or store in mock adapter
      const res = await uploadProductImageAction({
        base64Data: compressed.dataUrl,
        fileName: file.name,
      });

      if (res.ok) {
        setImageUrl(res.data.imageUrl);
      } else {
        setGeneralError(actionErrorMessage(res));
      }
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : "Error compressing image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Client-side schema validation with inline translated errors
    const clientValidation = productFormInputSchema.safeParse({
      name,
      categoryId,
      description: description || null,
      price: priceStr,
      unitCost: unitCostStr || 0,
      stock,
      visible,
      allergens,
      suggestAddOns,
      imageUrl,
    });

    if (!clientValidation.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of clientValidation.error.issues) {
        const field = issue.path[0] ? String(issue.path[0]) : "general";
        if (!errors[field]) errors[field] = [];
        errors[field].push(issue.message);
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setGeneralError(null);

    startTransition(async () => {
      const payload = {
        name,
        categoryId,
        description: description || null,
        price: priceStr,
        unitCost: unitCostStr || 0,
        stock,
        visible,
        allergens,
        suggestAddOns,
        imageUrl,
      };

      const res =
        isEditing && product
          ? await updateProductAction({ id: product.id, ...payload })
          : await createProductAction(payload);

      if (res.ok) {
        onProductSaved?.(res.data);
        onOpenChange(false);
      } else {
        setGeneralError(actionErrorMessage(res));
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
      }
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92vh] max-w-lg overflow-y-auto p-0"
        data-testid="product-form-sheet"
      >
        <SheetHeader className="border-border border-b px-5 pt-4 pr-12 pb-3 text-left">
          <SheetTitle className="text-foreground text-lg font-bold">
            {isEditing ? "Edit Product" : "Add Product"}
          </SheetTitle>
          <p className="text-muted-foreground text-xs font-medium">
            Manage item details, pricing & stock
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-4">
          {/* Section 1: Product Photo Upload */}
          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Product Photo
            </span>

            <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-3.5">
              <div className="border-border bg-muted/40 relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={name || "Product photo"}
                    fill
                    sizes="80px"
                    unoptimized={imageUrl.startsWith("data:")}
                    className="object-cover"
                  />
                ) : (
                  <Camera className="text-muted-foreground h-8 w-8 stroke-[1.5]" />
                )}
                {isUploadingImage && (
                  <div className="bg-background/80 absolute inset-0 flex items-center justify-center">
                    <Loader2 className="text-primary h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <p className="text-foreground text-xs font-semibold">Upload & compress image</p>
                <p className="text-muted-foreground text-caption">
                  PNG, JPG up to 5MB. Automatically resized.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <label className="bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/80 inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-xs font-medium transition-colors">
                    <span>{imageUrl ? "Change photo" : "Select photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="sr-only"
                      disabled={isUploadingImage || isPending}
                      data-testid="product-image-input"
                    />
                  </label>

                  {imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="text-destructive hover:bg-destructive/10 h-8 px-2 text-xs"
                      aria-label="Remove image"
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: General Information */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                General Information
              </span>
              <span className="text-muted-foreground text-caption">* Required</span>
            </div>

            {/* Product Name */}
            <div>
              <label
                htmlFor="product-name"
                className="text-foreground mb-1 block text-xs font-medium"
              >
                Product name *
              </label>
              <Input
                id="product-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Burger Gourmet"
                className="h-11 text-sm font-medium"
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
                data-testid="product-name-input"
                required
              />
              {fieldErrors.name && (
                <p id="name-error" className="text-destructive mt-1 text-xs font-medium">
                  {fieldErrors.name[0]}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label
                htmlFor="product-category"
                className="text-foreground mb-1 block text-xs font-medium"
              >
                Category *
              </label>
              <select
                id="product-category"
                name="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="border-input bg-card text-foreground focus:ring-ring h-11 w-full rounded-md border px-3 text-sm font-medium focus:ring-2 focus:outline-none"
                aria-describedby={fieldErrors.categoryId ? "cat-error" : undefined}
                data-testid="product-category-select"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <p id="cat-error" className="text-destructive mt-1 text-xs font-medium">
                  {fieldErrors.categoryId[0]}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="product-description"
                className="text-foreground mb-1 block text-xs font-medium"
              >
                Description (optional)
              </label>
              <Textarea
                id="product-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ingredients, allergens, details..."
                rows={3}
                className="text-sm font-normal"
                data-testid="product-description-input"
              />
            </div>
          </div>

          <fieldset className="border-border bg-card rounded-lg border p-3.5">
            <legend className="text-foreground px-1 text-sm font-semibold">
              {dict.allergensLabel}
            </legend>
            <div className="flex flex-wrap gap-2">
              {allergenSchema.options.map((allergen) => (
                <button
                  key={allergen}
                  type="button"
                  aria-pressed={allergens.includes(allergen)}
                  disabled={isPending}
                  onClick={() =>
                    setAllergens((selected) =>
                      selected.includes(allergen)
                        ? selected.filter((value) => value !== allergen)
                        : [...selected, allergen],
                    )
                  }
                  className="border-input text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:ring-ring min-h-11 min-w-11 rounded-full border px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none active:opacity-80"
                  data-testid={`product-allergen-${allergen}`}
                >
                  {dict.allergenLabels[allergen]}
                </button>
              ))}
            </div>
            {fieldErrors.allergens && (
              <p role="alert" className="text-destructive mt-1 text-xs">
                {fieldErrors.allergens[0]}
              </p>
            )}
          </fieldset>

          {/* Section 3: Pricing & Economics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Pricing & Margin
              </span>
              {priceInCents > 0 && (
                <span className="bg-primary-soft text-primary-soft-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold">
                  {grossMargin}% margin
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="product-price"
                  className="text-foreground mb-1 block text-xs font-medium"
                >
                  Selling price (€) *
                </label>
                <Input
                  id="product-price"
                  name="price"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="12.50"
                  className="h-11 text-sm font-semibold tabular-nums"
                  aria-describedby={fieldErrors.price ? "price-error" : undefined}
                  data-testid="product-price-input"
                  required
                />
                {fieldErrors.price && (
                  <p id="price-error" className="text-destructive mt-1 text-xs font-medium">
                    {fieldErrors.price[0]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="product-unit-cost"
                  className="text-foreground mb-1 block text-xs font-medium"
                >
                  Unit cost (€)
                </label>
                <Input
                  id="product-unit-cost"
                  name="unitCost"
                  value={unitCostStr}
                  onChange={(e) => setUnitCostStr(e.target.value)}
                  placeholder="4.20"
                  className="h-11 text-sm font-semibold tabular-nums"
                  aria-describedby={fieldErrors.unitCost ? "cost-error" : undefined}
                  data-testid="product-unit-cost-input"
                />
                {fieldErrors.unitCost && (
                  <p id="cost-error" className="text-destructive mt-1 text-xs font-medium">
                    {fieldErrors.unitCost[0]}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Inventory & Stock */}
          <div className="border-border bg-card space-y-2 rounded-lg border p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="product-stock" className="text-foreground text-xs font-semibold">
                  {isEditing ? "Current Stock" : "Initial Stock"}
                </label>
                <p className="text-muted-foreground text-caption">
                  Alert threshold set at {lowStockThreshold} units
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setStock((prev) => Math.max(0, prev - 1))}
                  className="text-foreground h-9 w-9"
                  aria-label="Decrease stock"
                >
                  -
                </Button>
                <Input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-9 w-16 text-center text-sm font-bold tabular-nums"
                  data-testid="product-stock-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setStock((prev) => prev + 1)}
                  className="text-foreground h-9 w-9"
                  aria-label="Increase stock"
                >
                  +
                </Button>
              </div>
            </div>
          </div>

          {/* Section 5: Visibility Toggle */}
          <div className="border-border bg-card flex items-center justify-between rounded-lg border p-3.5">
            <div>
              <span className="text-foreground text-xs font-semibold">Visible on menu</span>
              <p className="text-muted-foreground text-caption">
                Customers can see and order this item on the storefront
              </p>
            </div>
            <Switch
              checked={visible}
              onCheckedChange={setVisible}
              aria-label="Visible on menu"
              data-testid="product-visibility-switch"
            />
          </div>

          <div className="border-border bg-card flex items-center justify-between gap-3 rounded-lg border p-3.5">
            <label
              htmlFor="product-suggest-add-ons"
              className="flex min-h-11 min-w-11 flex-1 cursor-pointer flex-col justify-center"
            >
              <span className="text-foreground text-sm font-semibold">
                {dict.suggestAddOnsLabel}
              </span>
              <span id="product-suggest-add-ons-helper" className="text-muted-foreground text-xs">
                {dict.suggestAddOnsHelper}
              </span>
            </label>
            <Switch
              id="product-suggest-add-ons"
              checked={suggestAddOns}
              onCheckedChange={setSuggestAddOns}
              disabled={isPending}
              aria-label={dict.suggestAddOnsLabel}
              aria-describedby="product-suggest-add-ons-helper"
              className="relative before:absolute before:inset-x-0 before:-inset-y-2.5 active:opacity-80"
              data-testid="product-suggest-add-ons-switch"
            />
          </div>

          {/* General Error */}
          {generalError && (
            <p className="text-destructive text-xs font-medium" role="alert">
              {generalError}
            </p>
          )}

          {/* Action Footer */}
          {/* TODO(design): scale down action buttons from h-12 to min-h-11 to align with Stitch mobile tokens */}
          <div className="border-border bg-card pb-safe-4 -mx-5 -mb-4 flex items-center gap-3 border-t px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-12 flex-1 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || isUploadingImage}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 flex-2 font-semibold"
              data-testid="save-product-button"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Check className="mr-2 h-5 w-5" />
              )}
              {isEditing ? "Save Changes" : "Save Product"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
