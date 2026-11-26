"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  canDeactivatePickupLocation,
  canDeletePickupLocation,
  canDisableShopPickup,
  createPickupLocationSchema,
  MAX_PICKUP_LOCATIONS,
  reorderPickupLocationsSchema,
  updatePickupLocationSchema,
  type PickupRuleContext,
} from "@/domain/pickup-location";
import { uuidSchema } from "@/domain/common";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
import { getRepositories } from "@/lib/repositories";
import { revalidateStorefrontCatalog } from "@/features/storefront/catalog-data";

/** Reasons the UI maps to localized copy (`common.actionReasons`). */
const LAST_PICKUP_OPTION = "LAST_PICKUP_OPTION";
const PICKUP_LOCATIONS_LIMIT = "PICKUP_LOCATIONS_LIMIT";

const lastOptionError = () =>
  new ActionError("CONFLICT", "Pickup needs at least one active option", {
    reason: LAST_PICKUP_OPTION,
  });

/** Manager pages that show pickup locations, plus the public storefront (it renders them). */
function revalidatePickup(businessId: string) {
  revalidatePath("/manage/settings/pickup-locations");
  revalidatePath("/manage/settings/ordering");
  revalidatePath("/manage/settings");
  revalidateStorefrontCatalog(businessId);
}

/** What the "at least one active pickup option" rule needs, read fresh for the session's business. */
async function loadPickupRuleContext(businessId: string) {
  const repos = getRepositories();
  const [settings, locations] = await Promise.all([
    repos.business.getSettings(businessId),
    repos.pickupLocations.listByBusiness(businessId),
  ]);
  const context: PickupRuleContext = {
    pickupServiceEnabled: settings?.serviceTypes.pickup ?? true,
    shopPickupEnabled: settings?.shopPickupEnabled ?? true,
    locations,
  };
  return { repos, context };
}

export const createPickupLocationAction = defineAction(
  "createPickupLocation",
  { input: createPickupLocationSchema },
  async ({ input, businessId }) => {
    const { repos, context } = await loadPickupRuleContext(businessId);
    if (context.locations.length >= MAX_PICKUP_LOCATIONS) {
      throw new ActionError("CONFLICT", "Pickup location limit reached", {
        reason: PICKUP_LOCATIONS_LIMIT,
      });
    }
    const created = await repos.pickupLocations.create(businessId, input);
    revalidatePickup(businessId);
    return created;
  },
);

export const updatePickupLocationAction = defineAction(
  "updatePickupLocation",
  { input: updatePickupLocationSchema },
  async ({ input, businessId }) => {
    const { id, ...patch } = input;
    const { repos, context } = await loadPickupRuleContext(businessId);
    const current = context.locations.find((location) => location.id === id);
    if (!current) throw new ActionError("NOT_FOUND");
    if (current.isActive && patch.isActive === false && !canDeactivatePickupLocation(context, id)) {
      throw lastOptionError();
    }
    const updated = await repos.pickupLocations.update(businessId, id, patch);
    revalidatePickup(businessId);
    return updated;
  },
);

export const setPickupLocationActiveAction = defineAction(
  "setPickupLocationActive",
  { input: z.object({ id: uuidSchema, isActive: z.boolean() }) },
  async ({ input, businessId }) => {
    const { repos, context } = await loadPickupRuleContext(businessId);
    const current = context.locations.find((location) => location.id === input.id);
    if (!current) throw new ActionError("NOT_FOUND");
    if (current.isActive && !input.isActive && !canDeactivatePickupLocation(context, input.id)) {
      throw lastOptionError();
    }
    const updated = await repos.pickupLocations.update(businessId, input.id, {
      isActive: input.isActive,
    });
    revalidatePickup(businessId);
    return updated;
  },
);

export const deletePickupLocationAction = defineAction(
  "deletePickupLocation",
  { input: z.object({ id: uuidSchema }) },
  async ({ input, businessId }) => {
    const { repos, context } = await loadPickupRuleContext(businessId);
    const current = context.locations.find((location) => location.id === input.id);
    if (!current) throw new ActionError("NOT_FOUND");
    if (current.isActive && !canDeletePickupLocation(context, input.id)) {
      throw lastOptionError();
    }
    await repos.pickupLocations.delete(businessId, input.id);
    revalidatePickup(businessId);
  },
);

export const reorderPickupLocationsAction = defineAction(
  "reorderPickupLocations",
  { input: reorderPickupLocationsSchema },
  async ({ input, businessId }) => {
    const { repos, context } = await loadPickupRuleContext(businessId);
    const known = new Set(context.locations.map((location) => location.id));
    if (!input.ids.every((id) => known.has(id))) throw new ActionError("NOT_FOUND");
    const reordered = await repos.pickupLocations.reorder(businessId, input.ids);
    revalidatePickup(businessId);
    return reordered;
  },
);

/** Turns the shop itself on or off as a pickup option (relay locations stay). */
export const setShopPickupEnabledAction = defineAction(
  "setShopPickupEnabled",
  { input: z.object({ enabled: z.boolean() }) },
  async ({ input, businessId }) => {
    const { repos, context } = await loadPickupRuleContext(businessId);
    if (!input.enabled && context.shopPickupEnabled && !canDisableShopPickup(context)) {
      throw lastOptionError();
    }
    const updated = await repos.business.updateSettings(businessId, {
      shopPickupEnabled: input.enabled,
    });
    revalidatePickup(businessId);
    return updated;
  },
);
