import "server-only";

import { requireAuthenticatedAction } from "@/features/auth";
import { getRepositories } from "@/lib/repositories";
import { summarizeCustomers, uuidSchema } from "@/domain";

export async function listCustomers() {
  const { businessId } = await requireAuthenticatedAction();
  const repos = getRepositories();
  const [guests, orders] = await Promise.all([
    repos.guests.list(businessId),
    repos.orders.list(businessId),
  ]);
  return summarizeCustomers(guests, orders).toSorted(
    (a, b) =>
      (b.lastOrderDate ?? "").localeCompare(a.lastOrderDate ?? "") ||
      a.guest.name.localeCompare(b.guest.name),
  );
}

export async function getCustomer(id: string) {
  const { businessId } = await requireAuthenticatedAction();
  if (!uuidSchema.safeParse(id).success) return null;
  const repos = getRepositories();
  const guest = await repos.guests.findById(businessId, id);
  if (!guest) return null;
  const orders = await repos.orders.list(businessId, { guestId: id });
  return {
    summary: summarizeCustomers([guest], orders)[0],
    orders: orders.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
