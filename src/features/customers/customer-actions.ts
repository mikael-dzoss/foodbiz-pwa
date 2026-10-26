"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedAction } from "@/features/auth";
import { getRepositories } from "@/lib/repositories";
import { updateCustomerInputSchema, type Guest } from "@/domain";

export type CustomerActionResult =
  | { success: true; data: Guest }
  | {
      success: false;
      error: "invalid" | "notFound" | "saveFailed";
      fieldErrors?: Record<string, string[]>;
    };

export async function updateCustomerAction(input: unknown): Promise<CustomerActionResult> {
  const { businessId } = await requireAuthenticatedAction();
  const parsed = updateCustomerInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "invalid",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const { id, name, notes } = parsed.data;
  const repos = getRepositories();
  let updated: Guest;
  try {
    if (!(await repos.guests.findById(businessId, id))) {
      return { success: false, error: "notFound" };
    }
    updated = await repos.guests.update(businessId, id, { name, notes: notes || null });
  } catch {
    console.error("Customer update failed");
    return { success: false, error: "saveFailed" };
  }
  revalidatePath("/manage", "layout");
  return { success: true, data: updated };
}
