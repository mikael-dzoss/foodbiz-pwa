import { cacheLife, cacheTag, revalidateTag, revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { createPublicServerClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/config/env";
import type { Repositories } from "@/domain/repositories";
import { DEMO_BUSINESS_ID } from "@/lib/repositories/mock/fixtures/business";
import { featuredDateRange, rankFeaturedQuantities } from "@/domain/featured";
import type { Business, BusinessSettings } from "@/domain/business";
import type { Product, ProductCategory } from "@/domain/product";

export interface GroupedCategory {
  id: string;
  name: string;
  sortOrder: number;
  products: Product[];
}

export interface StorefrontCatalogData {
  business: Business;
  settings: BusinessSettings | null;
  categories: ProductCategory[];
  groupedCategories: GroupedCategory[];
  featuredProducts: Product[];
  totalVisibleProducts: number;
  isAcceptingOrders: boolean;
  isOpen: boolean;
  openingHoursText: string | null;
  currentYear?: number;
}

export interface StorefrontProductData {
  product: Product;
  categoryName: string;
  business: Business;
  settings: BusinessSettings | null;
  isAcceptingOrders: boolean;
  isOpen: boolean;
}

/**
 * Checks if the store is currently open based on opening hours and system time.
 * If no opening hours are set, defaults to open (unless acceptingOrders is explicitly false).
 */
export function evaluateStoreOperatingStatus(
  settings: BusinessSettings | null,
  now: Date = new Date(),
): { isOpen: boolean; isAcceptingOrders: boolean; scheduleText: string | null } {
  const isAcceptingOrders = settings?.acceptingOrders ?? true;
  const openingHours = settings?.openingHours?.trim() || null;

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
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

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

function getCatalogRepositories(): Repositories {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder")) {
    return getRepositories("mock");
  }

  try {
    const dataSource = getServerEnv().DATA_SOURCE;
    if (dataSource === "supabase") {
      return createSupabaseRepositories(createPublicServerClient, { publicOnly: true });
    }
    return getRepositories();
  } catch {
    return getRepositories("mock");
  }
}

/**
 * Server-rendered, cached catalog query for the public storefront (#80, #82, #83).
 * Groups visible products by category.
 */
export async function getStorefrontCatalog(
  businessId = DEMO_BUSINESS_ID,
): Promise<StorefrontCatalogData> {
  "use cache";
  cacheTag("storefront-catalog", `storefront-catalog-${businessId}`);
  cacheLife("hours");

  let repos = getCatalogRepositories();
  let business: Business | null = null;
  let settings: BusinessSettings | null = null;
  let categories: ProductCategory[] = [];
  let products: Product[] = [];

  try {
    [business, settings, categories, products] = await Promise.all([
      repos.business.findById(businessId),
      repos.business.getSettings(businessId),
      repos.categories.list(businessId),
      repos.products.list(businessId, { visibleOnly: true }),
    ]);
  } catch {
    repos = getRepositories("mock");
    [business, settings, categories, products] = await Promise.all([
      repos.business.findById(businessId),
      repos.business.getSettings(businessId),
      repos.categories.list(businessId),
      repos.products.list(businessId, { visibleOnly: true }),
    ]);
  }

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

  const uncategorized: Product[] = [];

  for (const prod of visibleProducts) {
    const group = categoryMap.get(prod.categoryId);
    if (group) {
      group.products.push(prod);
    } else {
      uncategorized.push(prod);
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
  const featuredProducts =
    recentFeatured.length > 0
      ? recentFeatured
      : rankFeaturedQuantities(
          visibleProducts,
          await repos.orders.sumQuantitiesByProduct(businessId, featuredDateRange(now, 30)),
        );
  const operatingStatus = evaluateStoreOperatingStatus(settings, now);

  return {
    business,
    settings,
    categories,
    groupedCategories,
    featuredProducts,
    totalVisibleProducts: visibleProducts.length,
    isAcceptingOrders: operatingStatus.isAcceptingOrders,
    isOpen: operatingStatus.isOpen,
    openingHoursText: operatingStatus.scheduleText,
    currentYear: now.getFullYear(),
  };
}

/**
 * Server-rendered, cached query for a single storefront product (#81).
 * Returns null if product is missing or hidden (visible === false).
 */
export async function getStorefrontProduct(
  productId: string,
  businessId = DEMO_BUSINESS_ID,
): Promise<StorefrontProductData | null> {
  "use cache";
  cacheTag("storefront-catalog", `storefront-product-${productId}`);
  cacheLife("hours");

  let repos = getCatalogRepositories();
  let business: Business | null = null;
  let settings: BusinessSettings | null = null;
  let product: Product | null = null;

  try {
    [business, settings, product] = await Promise.all([
      repos.business.findById(businessId),
      repos.business.getSettings(businessId),
      repos.products.findById(businessId, productId),
    ]);
  } catch {
    repos = getRepositories("mock");
    [business, settings, product] = await Promise.all([
      repos.business.findById(businessId),
      repos.business.getSettings(businessId),
      repos.products.findById(businessId, productId),
    ]);
  }

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

  const operatingStatus = evaluateStoreOperatingStatus(settings);

  return {
    product,
    categoryName,
    business,
    settings,
    isAcceptingOrders: operatingStatus.isAcceptingOrders,
    isOpen: operatingStatus.isOpen,
  };
}

/**
 * Server query to fetch latest prices and stock for a list of products (Issue #85).
 * Refreshes prices from server to prevent stale checkout numbers.
 */
export async function getLatestProductPrices(
  productIds: string[],
  businessId = DEMO_BUSINESS_ID,
): Promise<Array<{ id: string; name: string; price: number; stock: number; visible: boolean }>> {
  const repos = getCatalogRepositories();
  const products = await Promise.all(
    productIds.map((id) => repos.products.findById(businessId, id)),
  );

  return products
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      visible: p.visible,
    }));
}

/**
 * Revalidates all storefront cached data when products, categories, or settings mutate.
 */
export async function revalidateStorefrontCatalog(businessId = DEMO_BUSINESS_ID): Promise<void> {
  revalidateTag("storefront-catalog", "max");
  revalidateTag(`storefront-catalog-${businessId}`, "max");
  revalidatePath("/[locale]", "layout");
}
