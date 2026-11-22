import type { Metadata } from "next";
import { getDictionary } from "@/domain/i18n";
import { requireManagerSession } from "@/lib/auth";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { getRepositories } from "@/lib/repositories";
import { ManualOrderForm } from "@/features/orders/components/manual-order-form";
import { getBusinessToday } from "@/features/settings/settings-data";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale());
  return {
    title: dict.orders.manual.title,
    description: dict.manager.meta.newOrderDescription,
  };
}

// Needs the visible product list and the business date before the form can render, so it blocks.
export const instant = false;

export default async function NewOrderPage() {
  const session = await requireManagerSession();
  const repos = getRepositories();
  const [products, today] = await Promise.all([
    repos.products.list(session.business.id, { visibleOnly: true }),
    getBusinessToday(),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <ManualOrderForm products={products} today={today} />
    </div>
  );
}
