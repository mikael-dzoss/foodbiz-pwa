"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getRepositories } from "@/lib/repositories";
import {
  forbiddenResult,
  isForbiddenError,
  requireAuthenticatedAction,
  requireOwnerAction,
} from "@/features/auth";
import { revalidateStorefrontCatalog } from "@/features/storefront/catalog-data";
import {
  updateBusinessProfileSchema,
  updateOrderingSettingsSchema,
  updatePaymentSettingsSchema,
  updateInventoryFinanceSettingsSchema,
  updateNotificationSettingsSchema,
  type ActionErrorCode,
  type Business,
  type BusinessSettings,
  type SupportedLocale,
  isOwnerRole,
  isSupportedLocale,
} from "@/domain";

export type SettingsActionResult<T = void> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      /** `FORBIDDEN` when the signed-in member's role may not do this (owner-only settings). */
      code?: ActionErrorCode;
    };

/**
 * Loads the current manager's business profile.
 */
export async function getBusinessProfileAction(): Promise<SettingsActionResult<Business>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const repos = getRepositories();
    const business = await repos.business.findById(businessId);
    if (!business) {
      return { success: false, error: "Business not found" };
    }
    return { success: true, data: business };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load business profile";
    return { success: false, error: message };
  }
}

/**
 * Loads the business operational settings (tax, notifications, thresholds).
 */
export async function getBusinessSettingsAction(): Promise<
  SettingsActionResult<BusinessSettings | null>
> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const repos = getRepositories();
    const settings = await repos.business.getSettings(businessId);
    return { success: true, data: settings };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load business settings";
    return { success: false, error: message };
  }
}

/**
 * Updates the business profile details (name, slug, description, contact channels, logo).
 */
export async function updateBusinessProfileAction(
  input: unknown,
): Promise<SettingsActionResult<Business>> {
  try {
    const { businessId, session } = await requireAuthenticatedAction();

    const parsed = updateBusinessProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid business profile data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();

    // The slug is the public storefront address: only an owner may change it.
    const current = await repos.business.findById(businessId);
    if (current && current.slug !== parsed.data.slug && !isOwnerRole(session.user.role)) {
      return forbiddenResult();
    }

    // Check slug uniqueness across other businesses
    const existingWithSlug = await repos.business.findBySlug(parsed.data.slug);
    if (existingWithSlug && existingWithSlug.id !== businessId) {
      return {
        success: false,
        error: "Store web address slug is already taken",
        fieldErrors: {
          slug: ["This web address is already in use by another shop"],
        },
      };
    }

    const updated = await repos.business.update(businessId, {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      phone: parsed.data.phone,
      email: parsed.data.email,
      whatsappNumber: parsed.data.whatsappNumber,
      instagramUrl: parsed.data.instagramUrl,
      facebookUrl: parsed.data.facebookUrl,
      tiktokUrl: parsed.data.tiktokUrl,
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      logoUrl: parsed.data.logoUrl,
    });

    revalidatePath("/manage/settings/business");
    revalidatePath("/manage/settings");
    revalidatePath("/manage");
    await revalidateStorefrontCatalog(businessId);

    return { success: true, data: updated };
  } catch (err) {
    if (isForbiddenError(err)) return forbiddenResult();
    return { success: false, error: "Failed to update business profile" };
  }
}

/**
 * Switches the active application language preference in cookie.
 */
export async function switchLanguageAction(
  locale: string,
): Promise<SettingsActionResult<SupportedLocale>> {
  try {
    await requireAuthenticatedAction();
    if (!isSupportedLocale(locale)) {
      return { success: false, error: `Unsupported locale: ${locale}` };
    }

    const cookieStore = await cookies();
    cookieStore.set("foodbiz_locale", locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });

    revalidatePath("/manage");
    return { success: true, data: locale };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update language";
    return { success: false, error: message };
  }
}

/**
 * Updates ordering preferences (fulfillment modes, opening hours, lead times, fees).
 */
export async function updateOrderingSettingsAction(
  input: unknown,
): Promise<SettingsActionResult<BusinessSettings>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = updateOrderingSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid ordering settings data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();
    const updated = await repos.business.updateSettings(businessId, parsed.data);

    revalidatePath("/manage/settings/ordering");
    revalidatePath("/manage/settings");
    revalidatePath("/manage");
    await revalidateStorefrontCatalog(businessId);

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update ordering settings";
    return { success: false, error: message };
  }
}

/**
 * Updates payment settings (direct identifiers, handover toggles, instructions).
 */
export async function updatePaymentSettingsAction(
  input: unknown,
): Promise<SettingsActionResult<BusinessSettings>> {
  try {
    // Payment identifiers and payment methods: owner only (also enforced by a database trigger).
    const { businessId } = await requireOwnerAction();
    const parsed = updatePaymentSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid payment settings data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();
    const updated = await repos.business.updateSettings(businessId, parsed.data);

    revalidatePath("/manage/settings/payment");
    revalidatePath("/manage/settings");
    revalidatePath("/manage");

    return { success: true, data: updated };
  } catch (err) {
    if (isForbiddenError(err)) return forbiddenResult();
    return { success: false, error: "Failed to update payment settings" };
  }
}

/**
 * Updates inventory & finance settings (low-stock threshold, currency, tax).
 */
export async function updateInventoryFinanceSettingsAction(
  input: unknown,
): Promise<SettingsActionResult<BusinessSettings>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = updateInventoryFinanceSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid inventory and finance settings data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();
    const updated = await repos.business.updateSettings(businessId, parsed.data);

    revalidatePath("/manage/settings/inventory-finance");
    revalidatePath("/manage/settings");
    revalidatePath("/manage");

    return { success: true, data: updated };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update inventory and finance settings";
    return { success: false, error: message };
  }
}

/**
 * Updates notification and alert settings (in-app alerts, sounds).
 */
export async function updateNotificationSettingsAction(
  input: unknown,
): Promise<SettingsActionResult<BusinessSettings>> {
  try {
    const { businessId } = await requireAuthenticatedAction();
    const parsed = updateNotificationSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid notification settings data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();
    const updated = await repos.business.updateSettings(businessId, parsed.data);

    revalidatePath("/manage/settings/notifications");
    revalidatePath("/manage/settings");
    revalidatePath("/manage");

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update notification settings";
    return { success: false, error: message };
  }
}
