"use server";

import { revalidatePath } from "next/cache";
import { getRepositories } from "@/lib/repositories";
import { defineAction } from "@/lib/actions/define-action";
import { ActionError } from "@/lib/actions/types";
import { updateCustomerInputSchema } from "@/domain";

export const updateCustomerAction = defineAction(
  "updateCustomer",
  { input: updateCustomerInputSchema },
  async ({ input: { id, name, notes }, businessId }) => {
    const repos = getRepositories();
    if (!(await repos.guests.findById(businessId, id))) throw new ActionError("NOT_FOUND");
    const updated = await repos.guests.update(businessId, id, { name, notes: notes || null });
    revalidatePath("/manage", "layout");
    return updated;
  },
);
