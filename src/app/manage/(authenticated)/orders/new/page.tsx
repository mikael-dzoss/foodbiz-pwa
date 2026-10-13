import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { getRepositories } from "@/lib/repositories";
import { ManualOrderForm } from "@/features/orders/components/manual-order-form";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `New Order | ${APP_METADATA.name}`,
  description: "Manually enter customer orders taken by phone, WhatsApp, or in person.",
};

export const instant = false;

export default async function NewOrderPage() {
  const session = await requireManagerSession();
  const repos = getRepositories();
  const products = await repos.products.list(session.business.id, { visibleOnly: true });

  return (
    <div className="mx-auto max-w-xl">
      <ManualOrderForm products={products} />
    </div>
  );
}
