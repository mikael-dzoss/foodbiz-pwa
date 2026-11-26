import { z } from "zod";

import { isoDateTimeSchema, uuidSchema } from "./common";
import {
  DAY_KEYS,
  weeklyHoursSchema,
  type HoursException,
  type OpeningSchedule,
  type WeeklyHours,
} from "./opening-hours";

/** Mirrored in `pickup_locations` constraints (migration 20260101000035). */
export const MAX_PICKUP_LOCATIONS = 20;
export const MAX_PICKUP_FEE_CENTS = 10_000;

const nameSchema = z.string().trim().min(1, "Name is required").max(80);
const descriptionSchema = z.string().trim().max(200).nullable();
const addressSchema = z.string().trim().min(1, "Address is required").max(200);
const postcodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "Postcode must be 5 digits");
const feeCentsSchema = z.number().int().min(0).max(MAX_PICKUP_FEE_CENTS);

export const pickupLocationSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  name: nameSchema,
  description: descriptionSchema,
  address: addressSchema,
  postcode: postcodeSchema,
  /** 0 means free. */
  feeCents: feeCentsSchema,
  /** null: no hours of its own (the business hours apply). Exceptions come from the business only. */
  weeklyHours: weeklyHoursSchema.nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type PickupLocation = z.infer<typeof pickupLocationSchema>;

export const createPickupLocationSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional().default(null),
  address: addressSchema,
  postcode: postcodeSchema,
  feeCents: feeCentsSchema.default(0),
  weeklyHours: weeklyHoursSchema.nullable().optional().default(null),
  isActive: z.boolean().default(true),
});

export type CreatePickupLocation = z.infer<typeof createPickupLocationSchema>;

export const updatePickupLocationSchema = z
  .object({
    id: uuidSchema,
    name: nameSchema.optional(),
    description: descriptionSchema.optional(),
    address: addressSchema.optional(),
    postcode: postcodeSchema.optional(),
    feeCents: feeCentsSchema.optional(),
    weeklyHours: weeklyHoursSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(({ id: _id, ...patch }) => Object.values(patch).some((value) => value !== undefined), {
    error: "Nothing to update",
  });

export type UpdatePickupLocation = z.infer<typeof updatePickupLocationSchema>;

export const reorderPickupLocationsSchema = z.object({
  ids: z
    .array(uuidSchema)
    .min(1)
    .max(MAX_PICKUP_LOCATIONS)
    .refine((ids) => new Set(ids).size === ids.length, { error: "Duplicate location ids" }),
});

export type ReorderPickupLocations = z.infer<typeof reorderPickupLocationsSchema>;

export interface PickupOptions {
  readonly shopPickupEnabled: boolean;
  readonly locations: readonly Pick<PickupLocation, "id" | "isActive">[];
}

/** True when at least one pickup option (the shop or an active relay location) is offered. */
export function hasActivePickupOption({ shopPickupEnabled, locations }: PickupOptions): boolean {
  return shopPickupEnabled || locations.some((location) => location.isActive);
}

export interface PickupRuleContext extends PickupOptions {
  /** `service_types.pickup`; the rule only applies while the pickup service type is enabled. */
  readonly pickupServiceEnabled: boolean;
}

/** Pickup stays offered while at least one option is active (only when the pickup service is on). */
export function canDeactivatePickupLocation(context: PickupRuleContext, id: string): boolean {
  if (!context.pickupServiceEnabled) return true;
  return hasActivePickupOption({
    shopPickupEnabled: context.shopPickupEnabled,
    locations: context.locations.map((location) =>
      location.id === id ? { ...location, isActive: false } : location,
    ),
  });
}

export function canDeletePickupLocation(context: PickupRuleContext, id: string): boolean {
  if (!context.pickupServiceEnabled) return true;
  return hasActivePickupOption({
    shopPickupEnabled: context.shopPickupEnabled,
    locations: context.locations.filter((location) => location.id !== id),
  });
}

export function canDisableShopPickup(context: PickupRuleContext): boolean {
  if (!context.pickupServiceEnabled) return true;
  return hasActivePickupOption({ shopPickupEnabled: false, locations: context.locations });
}

/** Public fields of an active location, as shown on the storefront. */
export type StorefrontPickupLocation = Pick<
  PickupLocation,
  "id" | "name" | "description" | "address" | "postcode" | "feeCents" | "weeklyHours" | "sortOrder"
>;

export function toStorefrontPickupLocation(location: PickupLocation): StorefrontPickupLocation {
  return {
    id: location.id,
    name: location.name,
    description: location.description,
    address: location.address,
    postcode: location.postcode,
    feeCents: location.feeCents,
    weeklyHours: location.weeklyHours,
    sortOrder: location.sortOrder,
  };
}

/**
 * Opening schedule that applies to a relay pickup location. Mirrors `public.pickup_schedule_hours`
 * (20260101000036):
 * - location without hours of its own: the business schedule unchanged;
 * - otherwise the location weekly hours with every weekday the business has closed (an empty day
 *   in its weekly hours) emptied, and only the business CLOSED exceptions (empty ranges), never its
 *   special-hours ones. A business without weekly hours closes no weekday.
 */
export function pickupScheduleFor(
  business: OpeningSchedule,
  locationWeekly: WeeklyHours | null,
): OpeningSchedule {
  if (locationWeekly === null) return business;
  const businessWeekly = business.weekly;
  const weekly = Object.fromEntries(
    DAY_KEYS.map((day) => [
      day,
      businessWeekly !== null && businessWeekly[day].length === 0 ? [] : locationWeekly[day],
    ]),
  ) as WeeklyHours;
  const exceptions: HoursException[] = business.exceptions.filter((ex) => ex.ranges.length === 0);
  return { weekly, exceptions };
}

/** Google Maps search link for a physical address, or null when the address is empty. */
export function buildDirectionsUrl(address: string | null | undefined): string | null {
  const trimmed = address?.trim();
  if (!trimmed) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export interface ResolvedPickupDisplay {
  readonly isRelay: boolean;
  readonly name: string;
  readonly address: string | null;
  readonly directionsUrl: string | null;
}

/**
 * Resolves the display name, address and Google Maps directions URL for a pickup order.
 * Returns null for non-pickup orders. A missing relay name falls back to the shop.
 */
export function resolvePickupDisplay(
  serviceType: string,
  pickupLocation:
    { readonly name?: string | null; readonly address?: string | null } | null | undefined,
  shop: { readonly name?: string | null; readonly address?: string | null } | undefined,
  fallbackShopLabel: string,
): ResolvedPickupDisplay | null {
  if (serviceType !== "pickup") return null;
  const relayName = pickupLocation?.name?.trim() || null;
  const isRelay = relayName !== null;
  const name = relayName ?? shop?.name?.trim() ?? fallbackShopLabel;
  const address = isRelay
    ? pickupLocation?.address?.trim() || null
    : pickupLocation?.address?.trim() || shop?.address?.trim() || null;
  return {
    isRelay,
    name,
    address,
    directionsUrl: buildDirectionsUrl(address),
  };
}
