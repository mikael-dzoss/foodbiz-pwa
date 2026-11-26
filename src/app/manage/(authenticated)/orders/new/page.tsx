import type { Metadata } from "next";
import { getDictionary } from "@/domain/i18n";
import { requireManagerSession } from "@/lib/auth";
import { getManagerLocale } from "@/lib/i18n/manager-locale";
import { getManualOrderFormData } from "@/features/orders/order-data";
import { ManualOrderForm } from "@/features/orders/components/manual-order-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getManagerLocale());
  return {
    title: dict.orders.manual.title,
    description: dict.manager.meta.newOrderDescription,
  };
}

// Needs the visible product list, active relays and business date before the form can render.
export const instant = false;

export default async function NewOrderPage() {
  await requireManagerSession();
  const data = await getManualOrderFormData();

  return (
    <div className="mx-auto max-w-xl">
      <ManualOrderForm
        products={data.products}
        today={data.today}
        pickupLocations={data.pickupLocations}
        shopPickupEnabled={data.shopPickupEnabled}
        shopName={data.shopName}
      />
    </div>
  );
}
