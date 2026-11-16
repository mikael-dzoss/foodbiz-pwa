import type { z } from "zod";
import { businessSchema, type Business } from "./business";
import { productCategorySchema, type ProductCategory } from "./product";

/**
 * Business and category shapes sent to the browser by the public storefront. Like the product
 * DTO these are allow-lists: ids, slugs, currency and timestamps stay on the server.
 */
export const storefrontBusinessSchema = businessSchema.pick({
  name: true,
  description: true,
  phone: true,
  email: true,
  whatsappNumber: true,
  address: true,
  latitude: true,
  longitude: true,
  logoUrl: true,
  instagramUrl: true,
  facebookUrl: true,
  tiktokUrl: true,
});

export type StorefrontBusiness = z.infer<typeof storefrontBusinessSchema>;

export function toStorefrontBusiness(business: Business): StorefrontBusiness {
  return {
    name: business.name,
    description: business.description,
    phone: business.phone,
    email: business.email,
    whatsappNumber: business.whatsappNumber,
    address: business.address,
    latitude: business.latitude,
    longitude: business.longitude,
    logoUrl: business.logoUrl,
    instagramUrl: business.instagramUrl,
    facebookUrl: business.facebookUrl,
    tiktokUrl: business.tiktokUrl,
  };
}

export const storefrontCategorySchema = productCategorySchema.pick({
  id: true,
  name: true,
  sortOrder: true,
  role: true,
});

export type StorefrontCategory = z.infer<typeof storefrontCategorySchema>;

export function toStorefrontCategory(category: ProductCategory): StorefrontCategory {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    role: category.role,
  };
}
