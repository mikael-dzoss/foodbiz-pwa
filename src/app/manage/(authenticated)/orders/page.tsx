import type { Metadata } from "next";
import { requireManagerSession } from "@/lib/auth";
import { listOrdersAction } from "@/features/orders";
import { OrderList } from "@/features/orders/components/order-list";
import { APP_METADATA } from "@/config/app";

export const metadata: Metadata = {
  title: `Orders | ${APP_METADATA.name}`,
  description: "Triage and manage incoming orders by status and requested time.",
};

export const instant = false;

export default async function OrdersPage() {
  await requireManagerSession();
  const res = await listOrdersAction();

  const initialData = res.success
    ? res.data
    : {
        orders: [],
        counts: { active: 0, completed: 0, cancelled: 0, total: 0, unpaid: 0 },
      };

  return (
    <div className="mx-auto max-w-xl">
      <OrderList initialData={initialData} />
    </div>
  );
}
