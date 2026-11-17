import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";
import { ManualOrderForm } from "@/features/orders/components/manual-order-form";
import { getBusinessToday } from "@/features/settings/settings-data";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `New Order | ${APP_METADATA.name}`,
  description: "Manually enter customer orders taken by phone, WhatsApp, or in person.",
};

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
