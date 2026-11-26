import "server-only";
import { cacheLife, cacheTag, updateTag, revalidatePath } from "next/cache";
import { getStorefrontBusinessId, getStorefrontRepositories } from "@/lib/repositories/storefront";
import { DEFAULT_TIMEZONE, getZonedMinutesOfDay, getZonedParts } from "@/domain/timezone";
import { featuredDateRange, rankFeaturedQuantities } from "@/domain/featured";
import type { BusinessSettings } from "@/domain/business";
import {
  toStorefrontBusiness,
  toStorefrontCategory,
  type StorefrontBusiness,
  type StorefrontCategory,
} from "@/domain/storefront-business";
import { toStorefrontProduct, type StorefrontProduct } from "@/domain/storefront-product";

export interface GroupedCategory {
  id: string;
  name: string;
  sortOrder: number;
  products: StorefrontProduct[];
}

export interface StorefrontCatalogData {
  business: StorefrontBusiness;
  settings: BusinessSettings | null;
  categories: StorefrontCategory[];
  groupedCategories: GroupedCategory[];
  featuredProducts: StorefrontProduct[];
  totalVisibleProducts: number;
  isAcceptingOrders: boolean;
  isOpen: boolean;
  openingHoursText: string | null;
  currentYear?: number;
}

export interface StorefrontProductData {
  product: StorefrontProduct;
  categoryName: string;
  business: StorefrontBusiness;
  settings: BusinessSettings | null;
  isAcceptingOrders: boolean;
  isOpen: boolean;
}

/** True when the business configured weekly hours or any exceptional day (#372, #375). */
export function hasStructuredHours(settings: BusinessSettings | null): boolean {
  return Boolean(settings?.weeklyHours) || (settings?.hoursExceptions?.length ?? 0) > 0;
}

/**
 * Checks if the store is currently open based on opening hours and the current time on the
 * business clock (`settings.timezone`), not the server's.
 * With structured weekly hours or exceptions, `isOpen` is neutral (see `hasStructuredHours`).
 * If no opening hours are set, defaults to open (unless acceptingOrders is explicitly false).
 */
export function evaluateStoreOperatingStatus(
  settings: BusinessSettings | null,
  now: Date,
): { isOpen: boolean; isAcceptingOrders: boolean; scheduleText: string | null } {
  const isAcceptingOrders = settings?.acceptingOrders ?? true;
  const openingHours = settings?.openingHours?.trim() || null;

  // Structured hours (#372) are evaluated at request/client time against the business clock, never
  // here: cached fetchers only report whether orders are accepted. `isOpen` is a neutral value.
  if (hasStructuredHours(settings)) {
    return { isOpen: isAcceptingOrders, isAcceptingOrders, scheduleText: openingHours };
  }

  if (!openingHours) {
    return {
      isOpen: isAcceptingOrders,
      isAcceptingOrders,
      scheduleText: null,
    };
  }

  // Parse standard simple range e.g. "07:00 - 19:30" or "Mon-Sat: 07:00 - 19:30"
  // For resilient storefront calculation, parse time window if present
  let isOpen = isAcceptingOrders;
  const timeMatch = openingHours.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const [, startH, startM, endH, endM] = timeMatch;
    const startMinutes = parseInt(startH, 10) * 60 + parseInt(startM, 10);
    const endMinutes = parseInt(endH, 10) * 60 + parseInt(endM, 10);
    const currentMinutes = getZonedMinutesOfDay(now, settings?.timezone ?? DEFAULT_TIMEZONE);

    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
      isOpen = false;
    }
  }

  return {
    isOpen: isAcceptingOrders && isOpen,
    isAcceptingOrders,
    scheduleText: openingHours,
  };
}

/**
 * Server-rendered, cached catalog query for the public storefront (#80, #82, #83).
 * Groups visible products by category.
 */
export async function getStorefrontCatalog(): Promise<StorefrontCatalogData> {
  "use cache";
  // The business comes from server configuration only, never from the caller.
  const businessId = getStorefrontBusinessId();
  cacheTag("storefront-catalog", `storefront-catalog-${businessId}`);
  cacheLife("hours");

  // Read failures propagate to the route error boundary: never serve placeholder data.
  const repos = getStorefrontRepositories();
  const [business, settings, categories, products] = await Promise.all([
    repos.business.findById(businessId),
    repos.business.getSettings(businessId),
    repos.categories.list(businessId),
    repos.products.list(businessId, { visibleOnly: true }),
  ]);

  if (!business) {
    throw new Error(`Storefront business not found for id: ${businessId}`);
  }

  // Only visible products shown
  const visibleProducts = products.filter((p) => p.visible);

  // Group products by category
  const categoryMap = new Map<string, GroupedCategory>();
  for (const cat of categories) {
    categoryMap.set(cat.id, {
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sortOrder,
      products: [],
    });
  }

  const uncategorized: StorefrontProduct[] = [];

  for (const prod of visibleProducts) {
    const dto = toStorefrontProduct(prod);
    const group = categoryMap.get(prod.categoryId);
    if (group) {
      group.products.push(dto);
    } else {
      uncategorized.push(dto);
    }
  }

  // Filter out categories with 0 visible products and sort by sortOrder
  const groupedCategories = Array.from(categoryMap.values())
    .filter((g) => g.products.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (uncategorized.length > 0) {
    groupedCategories.push({
      id: "uncategorized",
      name: "Other",
      sortOrder: 9999,
      products: uncategorized,
    });
  }

  // Clock is read within use cache, so it advances when the hours cache revalidates.
  const now = new Date();
  const recentQuantities = await repos.orders.sumQuantitiesByProduct(
    businessId,
    featuredDateRange(now, 7),
  );
  const recentFeatured = rankFeaturedQuantities(visibleProducts, recentQuantities);
  const featuredProducts = (
    recentFeatured.length > 0
      ? recentFeatured
      : rankFeaturedQuantities(
          visibleProducts,
          await repos.orders.sumQuantitiesByProduct(businessId, featuredDateRange(now, 30)),
        )
  ).map(toStorefrontProduct);
  const operatingStatus = evaluateStoreOperatingStatus(settings, now);

  return {
    business: toStorefrontBusiness(business),
    settings,
    categories: categories.map(toStorefrontCategory),
    groupedCategories,
    featuredProducts,
    totalVisibleProducts: visibleProducts.length,
    isAcceptingOrders: operatingStatus.isAcceptingOrders,
    isOpen: operatingStatus.isOpen,
    openingHoursText: operatingStatus.scheduleText,
    currentYear: getZonedParts(now, settings?.timezone ?? DEFAULT_TIMEZONE).year,
  };
}

/**
 * Server-rendered, cached query for a single storefront product (#81).
 * Returns null if product is missing or hidden (visible === false).
 */
export async function getStorefrontProduct(
  productId: string,
): Promise<StorefrontProductData | null> {
  "use cache";
  const businessId = getStorefrontBusinessId();
  cacheTag("storefront-catalog", `storefront-product-${productId}`);
  cacheLife("hours");

  const repos = getStorefrontRepositories();
  const [business, settings, product] = await Promise.all([
    repos.business.findById(businessId),
    repos.business.getSettings(businessId),
    repos.products.findById(businessId, productId),
  ]);

  if (!business || !product || !product.visible) {
    return null;
  }

  let categoryName = "Products";
  if (product.categoryId) {
    const category = await repos.categories.findById(businessId, product.categoryId);
    if (category) {
      categoryName = category.name;
    }
  }

  // Clock is read within use cache, so it advances when the hours cache revalidates.
  const operatingStatus = evaluateStoreOperatingStatus(settings, new Date());

  return {
    product: toStorefrontProduct(product),
    categoryName,
    business: toStorefrontBusiness(business),
    settings,
    isAcceptingOrders: operatingStatus.isAcceptingOrders,
    isOpen: operatingStatus.isOpen,
  };
}

/**
 * Expires the cached storefront catalog (list and product pages share the `storefront-catalog`
 * tag) so the next visit reads fresh data. Server Actions only (`updateTag`): call it after any
 * change that customers can see: products, categories, stock, business profile and settings.
 */
export function revalidateStorefrontCatalog(businessId = getStorefrontBusinessId()): void {
  updateTag("storefront-catalog");
  updateTag(`storefront-catalog-${businessId}`);
  revalidatePath("/[locale]", "layout");
}
