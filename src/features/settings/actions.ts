"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getRepositories } from "@/lib/repositories";
import { requireAuthenticatedAction } from "@/features/auth";
import {
  updateBusinessProfileSchema,
  type Business,
  type BusinessSettings,
  type SupportedLocale,
  isSupportedLocale,
} from "@/domain";

export type SettingsActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

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
    const { businessId } = await requireAuthenticatedAction();

    const parsed = updateBusinessProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid business profile data",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const repos = getRepositories();

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
      address: parsed.data.address,
      logoUrl: parsed.data.logoUrl,
    });

    revalidatePath("/manage/settings/business");
    revalidatePath("/manage/settings");
    revalidatePath("/manage");

    return { success: true, data: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update business profile";
    return { success: false, error: message };
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
