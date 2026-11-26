"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getRepositories } from "@/lib/repositories";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
import { revalidateStorefrontCatalog } from "@/features/storefront/catalog-data";
import {
  updateBusinessProfileSchema,
  updateOrderingSettingsSchema,
  updateOpeningHoursSchema,
  updateHoursExceptionsSchema,
  updatePaymentSettingsSchema,
  updateInventoryFinanceSettingsSchema,
  updateNotificationSettingsSchema,
  SUPPORTED_LOCALES,
  LOCALE_COOKIE,
  isOwnerRole,
} from "@/domain";

/** Manager pages that show the settings, plus the public storefront (it renders them). */
function revalidateSettings(businessId: string, page: string) {
  revalidatePath(`/manage/settings/${page}`);
  revalidatePath("/manage/settings");
  revalidatePath("/manage");
  revalidateStorefrontCatalog(businessId);
}

/** Updates the business profile (name, slug, description, contact channels, logo). */
export const updateBusinessProfileAction = defineAction(
  "updateBusinessProfile",
  { input: updateBusinessProfileSchema },
  async ({ input, businessId, session }) => {
    const repos = getRepositories();

    // The slug is the public storefront address: only an owner may change it.
    const current = await repos.business.findById(businessId);
    if (!current) throw new ActionError("NOT_FOUND");
    if (current.slug !== input.slug && !isOwnerRole(session.user.role)) {
      throw new ActionError("FORBIDDEN");
    }

    const existingWithSlug = await repos.business.findBySlug(input.slug);
    if (existingWithSlug && existingWithSlug.id !== businessId) {
      throw new ActionError("CONFLICT", "Store web address slug is already taken", {
        fieldErrors: { slug: ["This web address is already in use by another shop"] },
      });
    }

    const updated = await repos.business.update(businessId, {
      name: input.name,
      slug: input.slug,
      description: input.description,
      phone: input.phone,
      email: input.email,
      whatsappNumber: input.whatsappNumber,
      instagramUrl: input.instagramUrl,
      facebookUrl: input.facebookUrl,
      tiktokUrl: input.tiktokUrl,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      logoUrl: input.logoUrl,
    });
    revalidateSettings(businessId, "business");
    return updated;
  },
);

/** Stores the manager's language preference in a cookie. */
export const switchLanguageAction = defineAction(
  "switchLanguage",
  { input: z.enum(SUPPORTED_LOCALES, { error: "Unsupported locale" }) },
  async ({ input: locale }) => {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
    revalidatePath("/manage");
    return locale;
  },
);

/** Ordering preferences (fulfillment modes, opening hours, lead times, fees). */
export const updateOrderingSettingsAction = defineAction(
  "updateOrderingSettings",
  { input: updateOrderingSettingsSchema },
  async ({ input, businessId }) => {
    const updated = await getRepositories().business.updateSettings(businessId, input);
    revalidateSettings(businessId, "ordering");
    return updated;
  },
);

/** Structured weekly opening hours, optional exceptions, and optional fallback free-text schedule (#372, #375). */
export const updateOpeningHoursAction = defineAction(
  "updateOpeningHours",
  { input: updateOpeningHoursSchema },
  async ({ input, businessId }) => {
    const updated = await getRepositories().business.updateSettings(businessId, {
      weeklyHours: input.weeklyHours,
      ...(input.hoursExceptions !== undefined ? { hoursExceptions: input.hoursExceptions } : {}),
      ...(input.openingHours !== undefined ? { openingHours: input.openingHours } : {}),
    });
    revalidateSettings(businessId, "opening-hours");
    revalidatePath("/manage/settings/ordering");
    return updated;
  },
);

/** Exceptional opening/closing days and holiday overrides (#375). */
export const updateHoursExceptionsAction = defineAction(
  "updateHoursExceptions",
  { input: updateHoursExceptionsSchema },
  async ({ input, businessId }) => {
    const updated = await getRepositories().business.updateSettings(businessId, {
      hoursExceptions: input.hoursExceptions,
    });
    revalidateSettings(businessId, "opening-hours");
    revalidatePath("/manage/settings/ordering");
    return updated;
  },
);

/** Payment identifiers, handover toggles and instructions: owner only (also a database trigger). */
export const updatePaymentSettingsAction = defineAction(
  "updatePaymentSettings",
  { auth: "owner", input: updatePaymentSettingsSchema },
  async ({ input, businessId }) => {
    const updated = await getRepositories().business.updateSettings(businessId, input);
    revalidateSettings(businessId, "payment");
    return updated;
  },
);

/** Inventory and finance settings (low-stock threshold, currency, tax). */
export const updateInventoryFinanceSettingsAction = defineAction(
  "updateInventoryFinanceSettings",
  { input: updateInventoryFinanceSettingsSchema },
  async ({ input, businessId }) => {
    const updated = await getRepositories().business.updateSettings(businessId, input);
    revalidateSettings(businessId, "inventory-finance");
    return updated;
  },
);

/** Notification and alert settings (in-app alerts, sounds). */
export const updateNotificationSettingsAction = defineAction(
  "updateNotificationSettings",
  { input: updateNotificationSettingsSchema },
  async ({ input, businessId }) => {
    const updated = await getRepositories().business.updateSettings(businessId, input);
    revalidateSettings(businessId, "notifications");
    return updated;
  },
);
